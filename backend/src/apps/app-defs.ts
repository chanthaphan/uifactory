import { randomBytes } from 'node:crypto';

export type PageType = 'ui' | 'chat';

export interface AppPage {
  id: string;
  name: string;
  slug: string;
  type: PageType;
  // ui pages
  html?: string;
  prompt?: string;
  queryId?: string;
  sample?: string;
  // chat pages
  chat?: { systemPrompt?: string; queryId?: string; greeting?: string };
  // named queries the page's UI may invoke (interactive reads + write-back)
  actions?: { name: string; queryId: string }[];
}

export interface AppDefinition {
  pages: AppPage[];
  theme?: Record<string, unknown>;
  /** When false, only editors/owner/admin may run write (mutation) actions. Default: allow. */
  allowWriteActions?: boolean;
}

export type AiMode = 'platform' | 'provider' | 'agent-api';

export interface AppAiConfig {
  mode: AiMode;
  provider?: {
    name: 'anthropic' | 'openai' | 'azure-openai';
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    endpoint?: string;
    deployment?: string;
    apiVersion?: string;
  };
  agent?: {
    url: string;
    apiKey?: string;
    authHeader?: string; // header name for the key, defaults to Authorization: Bearer <key>
    extraHeaders?: Record<string, string>;
  };
}

const MASK = '********';

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'app'}-${randomBytes(3).toString('hex')}`;
}

/** Accept legacy single-HTML definitions and coerce into the multi-page shape. */
export function normalizeDefinition(raw: unknown): AppDefinition {
  const def = (raw ?? {}) as Record<string, unknown>;
  if (Array.isArray(def.pages)) {
    return {
      pages: def.pages as AppPage[],
      theme: def.theme as Record<string, unknown> | undefined,
      allowWriteActions: def.allowWriteActions as boolean | undefined,
    };
  }
  // Legacy: { html, queryId?, prompt?, sample? } -> one ui page.
  if (typeof def.html === 'string') {
    return {
      pages: [
        {
          id: 'page-1',
          name: 'Home',
          slug: 'home',
          type: 'ui',
          html: def.html as string,
          queryId: def.queryId as string | undefined,
          prompt: def.prompt as string | undefined,
          sample: def.sample as string | undefined,
        },
      ],
    };
  }
  return { pages: [] };
}

export function emptyDefinition(): AppDefinition {
  return {
    pages: [
      { id: `page-${randomBytes(3).toString('hex')}`, name: 'Home', slug: 'home', type: 'ui' },
    ],
  };
}

export function parseAiConfig(raw: string | null | undefined): AppAiConfig {
  if (!raw) return { mode: 'platform' };
  try {
    const parsed = JSON.parse(raw) as AppAiConfig;
    return parsed.mode ? parsed : { mode: 'platform' };
  } catch {
    return { mode: 'platform' };
  }
}

/** Mask secrets before returning an app's AI config to the client. */
export function redactAiConfig(cfg: AppAiConfig): AppAiConfig {
  const out: AppAiConfig = { mode: cfg.mode };
  if (cfg.provider) {
    out.provider = { ...cfg.provider, apiKey: cfg.provider.apiKey ? MASK : undefined };
  }
  if (cfg.agent) {
    out.agent = { ...cfg.agent, apiKey: cfg.agent.apiKey ? MASK : undefined };
  }
  return out;
}

/** Merge an incoming (possibly redacted) AI config with the stored one, preserving secrets. */
export function mergeAiConfig(existing: AppAiConfig, incoming: AppAiConfig): AppAiConfig {
  const merged: AppAiConfig = { mode: incoming.mode || existing.mode };
  if (incoming.provider) {
    merged.provider = { ...incoming.provider };
    if (!incoming.provider.apiKey || incoming.provider.apiKey === MASK) {
      merged.provider.apiKey = existing.provider?.apiKey;
    }
  }
  if (incoming.agent) {
    merged.agent = { ...incoming.agent };
    if (!incoming.agent.apiKey || incoming.agent.apiKey === MASK) {
      merged.agent.apiKey = existing.agent?.apiKey;
    }
  }
  return merged;
}
