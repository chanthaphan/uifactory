import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI, { AzureOpenAI } from 'openai';
import { AppAiConfig } from './app-defs';
import { detectProviderName, defaultModel } from '../ai/ai.providers';
import { assertSafeUrl } from '../common/safe-url';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResult {
  reply: string;
  source: 'agent-api' | 'anthropic' | 'openai' | 'azure-openai' | 'mock';
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

  /** Run a chat turn using the app's AI/agent connection (or the platform default, or a mock). */
  async chat(cfg: AppAiConfig, system: string, messages: ChatMessage[], contextData?: unknown): Promise<ChatResult> {
    const grounded = this.withContext(system, contextData);

    if (cfg.mode === 'agent-api' && cfg.agent?.url) {
      return { reply: await this.callAgentApi(cfg, grounded, messages, contextData), source: 'agent-api' };
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

  private async callProvider(spec: ProviderSpec, system: string, messages: ChatMessage[]): Promise<string> {
    // Guard user-supplied (per-app) provider base URLs / endpoints against SSRF.
    if (spec.baseUrl) await assertSafeUrl(spec.baseUrl);
    if (spec.endpoint) await assertSafeUrl(spec.endpoint);
    if (spec.name === 'anthropic') {
      const client = new Anthropic({ apiKey: spec.apiKey, baseURL: spec.baseUrl || undefined });
      const res = await client.messages.create({
        model: spec.model,
        max_tokens: MAX_TOKENS,
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
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'system', content: system }, ...messages.filter((m) => m.role !== 'system')],
    });
    return res.choices[0]?.message?.content ?? '';
  }

  private async callAgentApi(cfg: AppAiConfig, system: string, messages: ChatMessage[], contextData?: unknown): Promise<string> {
    const agent = cfg.agent!;
    await assertSafeUrl(agent.url); // SSRF guard: external agent endpoint is user-supplied
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(agent.extraHeaders || {}) };
    if (agent.apiKey) {
      if (agent.authHeader) headers[agent.authHeader] = agent.apiKey;
      else headers['Authorization'] = `Bearer ${agent.apiKey}`;
    }
    const res = await axios.post(
      agent.url,
      { messages, system, data: contextData ?? null },
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
