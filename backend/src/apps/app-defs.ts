import { randomBytes } from 'node:crypto';

export type PageType = 'ui' | 'chat';

/** How a UI page is currently being authored. The runtime always renders `html`. */
export type EditorMode = 'ai' | 'canvas' | 'code';

export type ComponentType =
  | 'heading'
  | 'text'
  | 'metric'
  | 'table'
  | 'chart'
  | 'button'
  | 'textInput'
  | 'fileUpload'
  | 'image'
  | 'divider'
  | 'container';

/** A node in the drag-and-drop component tree. `props` is type-specific and free-form. */
export interface UiComponent {
  id: string;
  type: ComponentType;
  props: Record<string, unknown>;
  children?: UiComponent[];
}

/** The source of a drag-and-drop authored page; compiled to `html` for the runtime. */
export interface CanvasLayout {
  components: UiComponent[];
}

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
  /** Data source ids this page may use. Empty/undefined = all app data sources (no restriction). */
  dataSourceIds?: string[];
  /** Drag-and-drop component tree (when authored with the visual builder). */
  layout?: CanvasLayout;
  /** Remembers which editor the page was last authored in. */
  editorMode?: EditorMode;
  // chat pages
  chat?: { systemPrompt?: string; queryId?: string; greeting?: string; agentDataSourceId?: string };
  // named queries the page's UI may invoke (interactive reads + write-back)
  actions?: { name: string; queryId: string }[];
}

export interface AppDefinition {
  pages: AppPage[];
  theme?: Record<string, unknown>;
  /** When false, only editors/owner/admin may run write (mutation) actions. Default: allow. */
  allowWriteActions?: boolean;
  /** AGENTS.md/CLAUDE.md-style build guidelines fed to the AI/agent for generation and chat. */
  buildGuidelines?: string;
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
      buildGuidelines: def.buildGuidelines as string | undefined,
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

// ---- Template bundles (self-contained data sources + queries) ----

export interface TemplateDataSource {
  ref: string; // bundle-local placeholder id
  name: string;
  type: string; // REST | POSTGRES | SQLITE | MSGRAPH
  config: Record<string, unknown>;
}
export interface TemplateQuery {
  ref: string;
  name: string;
  dataSourceRef: string;
  config: Record<string, unknown>;
}
export interface TemplateBundle {
  definition: AppDefinition; // queryId/action refs point at TemplateQuery.ref values
  dataSources: TemplateDataSource[];
  queries: TemplateQuery[];
}

/** All query ids referenced by a definition (page query, chat query, and named actions). */
export function collectQueryIds(def: AppDefinition): string[] {
  const ids = new Set<string>();
  for (const p of def.pages || []) {
    if (p.queryId) ids.add(p.queryId);
    if (p.chat?.queryId) ids.add(p.chat.queryId);
    for (const a of p.actions ?? []) if (a.queryId) ids.add(a.queryId);
  }
  return [...ids];
}

/** Return a copy of the definition with every queryId replaced via the map (unmapped ids kept). */
export function remapQueryIds(def: AppDefinition, map: Record<string, string>): AppDefinition {
  const m = (id?: string) => (id && map[id] ? map[id] : id);
  return {
    ...def,
    pages: (def.pages || []).map((p) => ({
      ...p,
      queryId: m(p.queryId),
      chat: p.chat ? { ...p.chat, queryId: m(p.chat.queryId) } : p.chat,
      actions: p.actions ? p.actions.map((a) => ({ ...a, queryId: m(a.queryId) as string })) : p.actions,
    })),
  };
}

/** Return a copy of the definition with each page's dataSourceIds remapped (unmapped ids dropped). */
export function remapDataSourceIds(def: AppDefinition, map: Record<string, string>): AppDefinition {
  return {
    ...def,
    pages: (def.pages || []).map((p) => ({
      ...p,
      dataSourceIds: p.dataSourceIds?.map((id) => map[id]).filter((x): x is string => !!x),
    })),
  };
}

/** Parse a stored template, tolerating both bundle and legacy plain-definition shapes. */
export function parseTemplate(rawJson: string): TemplateBundle {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(rawJson) as Record<string, unknown>;
  } catch {
    return { definition: { pages: [] }, dataSources: [], queries: [] };
  }
  if (Array.isArray((obj as { pages?: unknown }).pages)) {
    return { definition: normalizeDefinition(obj), dataSources: [], queries: [] };
  }
  return {
    definition: normalizeDefinition((obj.definition as unknown) ?? { pages: [] }),
    dataSources: (obj.dataSources as TemplateDataSource[]) ?? [],
    queries: (obj.queries as TemplateQuery[]) ?? [],
  };
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
