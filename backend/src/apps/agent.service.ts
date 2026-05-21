import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI, { AzureOpenAI } from 'openai';
import { AppAiConfig } from './app-defs';
import { detectProviderName, defaultModel } from '../ai/ai.providers';
import { assertSafeUrl } from '../common/safe-url';
import { LIMITS } from '../common/limits';
import { RequestIdentity } from '../execution/execution.types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type ChatSource = 'agent-api' | 'anthropic' | 'openai' | 'azure-openai' | 'mock';

export interface ChatResult {
  reply: string;
  source: ChatSource;
}

export interface GenerationPayload {
  prompt: string;
  sample: string;
  currentHtml?: string;
  dataGuidance?: string;
  guidelines?: string;
  queryName?: string;
}

interface ProviderSpec {
  name: 'anthropic' | 'openai' | 'azure-openai';
  apiKey: string;
  model: string;
  baseUrl?: string;
  endpoint?: string;
  apiVersion?: string;
}

const MAX_TOKENS = 1500;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  /** Keep the most recent turns within a character budget so long histories don't overflow context. */
  private trimHistory(messages: ChatMessage[]): ChatMessage[] {
    const budget = LIMITS.chatHistoryCharBudget;
    const out: ChatMessage[] = [];
    let total = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const len = messages[i].content?.length ?? 0;
      if (out.length && total + len > budget) break;
      out.unshift(messages[i]);
      total += len;
    }
    return out;
  }

  /** Run a chat turn using the app's AI/agent connection (or the platform default, or a mock). */
  async chat(cfg: AppAiConfig, system: string, messages: ChatMessage[], contextData?: unknown, conversationId?: string, identity?: RequestIdentity): Promise<ChatResult> {
    messages = this.trimHistory(messages);
    const grounded = this.withContext(system, contextData);

    if (cfg.mode === 'agent-api' && cfg.agent?.url) {
      return { reply: await this.callAgentApi(cfg, grounded, messages, contextData, conversationId, identity), source: 'agent-api' };
    }

    const spec = this.resolveProviderSpec(cfg);
    if (spec) {
      const reply = await this.callProvider(spec, grounded, messages);
      return { reply, source: spec.name };
    }

    // No provider configured anywhere -> deterministic mock so chat still works.
    const last = [...messages].reverse().find((m) => m.role === 'user');
    return {
      reply: `(demo) No AI provider is configured for this app. You said: "${last?.content ?? ''}". Configure a provider key or an external agent API in the app's AI settings to get real answers.`,
      source: 'mock',
    };
  }

  private withContext(system: string, contextData?: unknown): string {
    const base = system?.trim() || 'You are a helpful assistant embedded in a business app.';
    if (contextData == null) return base;
    let json = '';
    try {
      json = JSON.stringify(contextData);
      if (json.length > 12000) json = json.slice(0, 12000) + '… (truncated)';
    } catch {
      json = '';
    }
    return json ? `${base}\n\nYou have access to the following app data (JSON) to answer questions:\n${json}` : base;
  }

  /** Build an effective provider spec from the app config, or fall back to the platform env config. */
  private resolveProviderSpec(cfg: AppAiConfig): ProviderSpec | null {
    if (cfg.mode === 'provider' && cfg.provider?.apiKey && cfg.provider.name) {
      const p = cfg.provider;
      return {
        name: p.name,
        apiKey: p.apiKey!,
        model: p.deployment || p.model || defaultModel(p.name),
        baseUrl: p.baseUrl,
        endpoint: p.endpoint,
        apiVersion: p.apiVersion,
      };
    }
    // Platform default from env.
    const name = detectProviderName();
    if (!name) return null;
    if (name === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      return { name, apiKey: process.env.ANTHROPIC_API_KEY, model: defaultModel(name), baseUrl: process.env.ANTHROPIC_BASE_URL };
    }
    if (name === 'openai' && process.env.OPENAI_API_KEY) {
      return { name, apiKey: process.env.OPENAI_API_KEY, model: defaultModel(name), baseUrl: process.env.OPENAI_BASE_URL };
    }
    if (name === 'azure-openai' && process.env.AZURE_OPENAI_API_KEY) {
      return {
        name,
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        model: defaultModel(name),
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
      };
    }
    return null;
  }

  private async callProvider(spec: ProviderSpec, system: string, messages: ChatMessage[], maxTokens = MAX_TOKENS): Promise<string> {
    // Guard user-supplied (per-app) provider base URLs / endpoints against SSRF.
    if (spec.baseUrl) await assertSafeUrl(spec.baseUrl);
    if (spec.endpoint) await assertSafeUrl(spec.endpoint);
    if (spec.name === 'anthropic') {
      const client = new Anthropic({ apiKey: spec.apiKey, baseURL: spec.baseUrl || undefined });
      const res = await client.messages.create({
        model: spec.model,
        max_tokens: maxTokens,
        system,
        messages: messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      });
      return res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
    }

    const client =
      spec.name === 'azure-openai'
        ? new AzureOpenAI({ apiKey: spec.apiKey, endpoint: spec.endpoint, apiVersion: spec.apiVersion || '2024-10-21', deployment: spec.model })
        : new OpenAI({ apiKey: spec.apiKey, baseURL: spec.baseUrl || undefined });
    const res = await client.chat.completions.create({
      model: spec.model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages.filter((m) => m.role !== 'system')],
    });
    return res.choices[0]?.message?.content ?? '';
  }

  /** Stream a provider completion, invoking onDelta with each text chunk. */
  private async streamProvider(spec: ProviderSpec, system: string, messages: ChatMessage[], onDelta: (t: string) => void): Promise<void> {
    if (spec.baseUrl) await assertSafeUrl(spec.baseUrl);
    if (spec.endpoint) await assertSafeUrl(spec.endpoint);
    const history = messages.filter((m) => m.role !== 'system');
    if (spec.name === 'anthropic') {
      const client = new Anthropic({ apiKey: spec.apiKey, baseURL: spec.baseUrl || undefined });
      const stream = await client.messages.create({
        model: spec.model,
        max_tokens: MAX_TOKENS,
        system,
        messages: history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        stream: true,
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') onDelta(event.delta.text);
      }
      return;
    }
    const client =
      spec.name === 'azure-openai'
        ? new AzureOpenAI({ apiKey: spec.apiKey, endpoint: spec.endpoint, apiVersion: spec.apiVersion || '2024-10-21', deployment: spec.model })
        : new OpenAI({ apiKey: spec.apiKey, baseURL: spec.baseUrl || undefined });
    const stream = await client.chat.completions.create({
      model: spec.model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'system', content: system }, ...history],
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) onDelta(delta);
    }
  }

  /**
   * Stream a chat turn. Provider LLMs stream token-by-token via onDelta; external agent APIs
   * and the mock have no token stream, so they emit a single chunk (graceful fallback).
   */
  async chatStream(
    cfg: AppAiConfig,
    system: string,
    messages: ChatMessage[],
    onDelta: (t: string) => void,
    contextData?: unknown,
    conversationId?: string,
    identity?: RequestIdentity,
  ): Promise<ChatSource> {
    messages = this.trimHistory(messages);
    const grounded = this.withContext(system, contextData);
    if (cfg.mode === 'agent-api' && cfg.agent?.url) {
      const reply = await this.callAgentApi(cfg, grounded, messages, contextData, conversationId, identity);
      onDelta(reply);
      return 'agent-api';
    }
    const spec = this.resolveProviderSpec(cfg);
    if (spec) {
      await this.streamProvider(spec, grounded, messages, onDelta);
      return spec.name;
    }
    const last = [...messages].reverse().find((m) => m.role === 'user');
    onDelta(`(demo) No AI provider is configured for this app. You said: "${last?.content ?? ''}". Configure a provider key or an external agent API in the app's AI settings to get real answers.`);
    return 'mock';
  }

  /** Generate a UI document using the app's own provider key or the platform default. Null if none. */
  async complete(cfg: AppAiConfig, system: string, userContent: string): Promise<{ text: string; source: ChatSource } | null> {
    const spec = this.resolveProviderSpec(cfg);
    if (!spec) return null;
    const text = await this.callProvider(spec, system, [{ role: 'user', content: userContent }], 8000);
    return { text, source: spec.name };
  }

  /** Ask an external agent API to generate a UI document (it returns HTML). */
  async generateUiViaAgent(cfg: AppAiConfig, payload: GenerationPayload): Promise<string> {
    const agent = cfg.agent!;
    await assertSafeUrl(agent.url);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(agent.extraHeaders || {}) };
    if (agent.apiKey) {
      if (agent.authHeader) headers[agent.authHeader] = agent.apiKey;
      else headers['Authorization'] = `Bearer ${agent.apiKey}`;
    }
    const res = await axios.post(
      agent.url,
      { task: 'generate-ui', ...payload },
      { headers, timeout: 60000, validateStatus: () => true },
    );
    if (res.status >= 400) throw new Error(`Agent API responded ${res.status}`);
    return this.extractReply(res.data);
  }

  private async callAgentApi(cfg: AppAiConfig, system: string, messages: ChatMessage[], contextData?: unknown, conversationId?: string, identity?: RequestIdentity): Promise<string> {
    const agent = cfg.agent!;
    await assertSafeUrl(agent.url); // SSRF guard: external agent endpoint is user-supplied
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(agent.extraHeaders || {}) };
    if (agent.apiKey) {
      if (agent.authHeader) headers[agent.authHeader] = agent.apiKey;
      else headers['Authorization'] = `Bearer ${agent.apiKey}`;
    }
    // Forward the signed end-user assertion so the agent can authenticate who is chatting.
    if (identity?.assertion) headers['X-UIFactory-User'] = identity.assertion;
    const last = [...messages].reverse().find((m) => m.role === 'user');
    const res = await axios.post(
      agent.url,
      {
        messages,
        system,
        data: contextData ?? null,
        // Convenience fields so simple conversation APIs work without parsing the full transcript.
        conversationId: conversationId ?? null,
        message: last?.content ?? '',
        // Server-trusted end-user identity (also signed in the X-UIFactory-User header).
        user: identity?.context ?? null,
        userAssertion: identity?.assertion ?? null,
      },
      { headers, timeout: 30000, validateStatus: () => true },
    );
    if (res.status >= 400) {
      throw new Error(`Agent API responded ${res.status}`);
    }
    return this.extractReply(res.data);
  }

  /** Tolerant extraction so common agent/LLM response shapes work out of the box. */
  private extractReply(data: unknown): string {
    if (typeof data === 'string') return data;
    const d = data as Record<string, any>;
    return (
      d?.reply ??
      d?.content ??
      d?.message?.content ??
      d?.message ??
      d?.output ??
      d?.choices?.[0]?.message?.content ??
      JSON.stringify(data)
    );
  }
}
