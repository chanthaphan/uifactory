import Anthropic from '@anthropic-ai/sdk';
import OpenAI, { AzureOpenAI } from 'openai';

export type AiProviderName = 'anthropic' | 'openai' | 'azure-openai';

export interface GenerationProvider {
  name: AiProviderName;
  model: string;
  generate(system: string, user: string): Promise<string>;
}

const MAX_TOKENS = 8000;

/** Resolve the requested provider name from AI_PROVIDER, or auto-detect from configured keys. */
export function detectProviderName(): AiProviderName | null {
  const explicit = (process.env.AI_PROVIDER || '').toLowerCase().trim();
  if (explicit === 'anthropic' || explicit === 'claude') return 'anthropic';
  if (explicit === 'openai') return 'openai';
  if (explicit === 'azure-openai' || explicit === 'azure') return 'azure-openai';

  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) return 'azure-openai';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

/** Whether the env vars required by a given provider are present. */
export function providerConfigured(name: AiProviderName): boolean {
  switch (name) {
    case 'anthropic':
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case 'openai':
      return Boolean(process.env.OPENAI_API_KEY);
    case 'azure-openai':
      return Boolean(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT);
  }
}

/** Default model/deployment for a provider when not explicitly configured. */
export function defaultModel(name: AiProviderName): string {
  switch (name) {
    case 'anthropic':
      return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    case 'openai':
      return process.env.OPENAI_MODEL || 'gpt-4o';
    case 'azure-openai':
      return process.env.AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_MODEL || 'gpt-4o';
  }
}

class AnthropicProvider implements GenerationProvider {
  readonly name = 'anthropic' as const;
  readonly model = defaultModel('anthropic');

  async generate(system: string, user: string): Promise<string> {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
    });
    const message = await client.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  }
}

class OpenAIProvider implements GenerationProvider {
  readonly name = 'openai' as const;
  readonly model = defaultModel('openai');

  async generate(system: string, user: string): Promise<string> {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
    const res = await client.chat.completions.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return res.choices[0]?.message?.content ?? '';
  }
}

class AzureOpenAIProvider implements GenerationProvider {
  readonly name = 'azure-openai' as const;
  readonly model = defaultModel('azure-openai');

  async generate(system: string, user: string): Promise<string> {
    const client = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
      deployment: this.model,
    });
    const res = await client.chat.completions.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return res.choices[0]?.message?.content ?? '';
  }
}

/** Returns an instance of the configured provider, or null when none is configured. */
export function resolveProvider(): GenerationProvider | null {
  const name = detectProviderName();
  if (!name || !providerConfigured(name)) return null;
  switch (name) {
    case 'anthropic':
      return new AnthropicProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'azure-openai':
      return new AzureOpenAIProvider();
  }
}
