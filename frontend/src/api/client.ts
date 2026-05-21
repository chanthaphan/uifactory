import axios from 'axios';

const http = axios.create({ baseURL: '/api', withCredentials: true });

// When the session expires, notify the app shell so it can show the login screen.
http.interceptors.response.use(
  (r) => r,
  (error) => {
    const url: string = error?.config?.url || '';
    const isAuthCall = url.includes('/auth/');
    if (axios.isAxiosError(error) && error.response?.status === 401 && !isAuthCall) {
      window.dispatchEvent(new CustomEvent('uifactory:unauthorized'));
    }
    return Promise.reject(error);
  },
);

// ---- shared types ----
export type DataSourceType = 'REST' | 'POSTGRES' | 'SQLITE' | 'MSGRAPH' | 'AGENT';
export type Role = 'admin' | 'member' | 'viewer';
export type AiProviderName = 'anthropic' | 'openai' | 'azure-openai';
export type PageType = 'ui' | 'chat';
export type Visibility = 'private' | 'org' | 'public';

export const PROVIDER_LABEL: Record<AiProviderName, string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  'azure-openai': 'Azure OpenAI',
};

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  avatarUrl?: string | null;
}
export interface AuthConfig {
  mode: 'azure' | 'dev';
  platformName: string;
  platformLogo?: string;
  platformBrandColor?: string;
}
export interface PlatformSettings {
  platformName: string;
  platformLogo: string;
  platformBrandColor: string;
  defaultAiProvider: string;
  defaultAiModel: string;
  defaultVisibility: Visibility;
}

export type DataSourceAuthMode = 'shared' | 'per-user';
export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  config: Record<string, unknown>;
  authMode?: DataSourceAuthMode;
  createdAt: string;
  updatedAt: string;
}
export interface AppCredentialStatus {
  dataSourceId: string;
  name: string;
  type: DataSourceType;
  hasCredential: boolean;
}
export interface QueryDef {
  id: string;
  name: string;
  dataSourceId: string;
  config: Record<string, unknown>;
}
export interface ExecutionResult {
  data: unknown;
  meta: { type: DataSourceType; durationMs: number; status?: number; rowCount?: number; columns?: string[] };
}
export interface GenerateUiResult {
  html: string;
  source: 'ai' | 'agent-api' | 'fallback';
  provider?: AiProviderName;
  model?: string;
  note?: string;
}
export interface AiStatus {
  configured: boolean;
  provider: AiProviderName | null;
  model: string | null;
}

export type EditorMode = 'ai' | 'canvas' | 'code';
export type ComponentType =
  | 'heading' | 'text' | 'metric' | 'table' | 'chart'
  | 'button' | 'textInput' | 'fileUpload' | 'image' | 'divider' | 'container';
export interface UiComponent {
  id: string;
  type: ComponentType;
  props: Record<string, unknown>;
  children?: UiComponent[];
}
export interface CanvasLayout {
  components: UiComponent[];
}

export interface AppPage {
  id: string;
  name: string;
  slug: string;
  type: PageType;
  html?: string;
  prompt?: string;
  queryId?: string;
  sample?: string;
  /** Data source ids this page may use. Empty/undefined = all app data sources (no restriction). */
  dataSourceIds?: string[];
  layout?: CanvasLayout;
  editorMode?: EditorMode;
  chat?: { systemPrompt?: string; queryId?: string; greeting?: string; agentDataSourceId?: string };
  actions?: { name: string; queryId: string }[];
}
export interface AppVersion {
  id: string;
  version: number;
  note?: string | null;
  createdBy?: string | null;
  createdAt: string;
  pageCount: number;
  isCurrent: boolean;
}
export interface Connector {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  type: DataSourceType;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface AppDefinition {
  pages: AppPage[];
  theme?: Record<string, unknown>;
  allowWriteActions?: boolean;
  buildGuidelines?: string;
}
export interface AppAiConfig {
  mode: 'platform' | 'provider' | 'agent-api';
  provider?: {
    name: AiProviderName;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    endpoint?: string;
    deployment?: string;
    apiVersion?: string;
  };
  agent?: { url: string; apiKey?: string; authHeader?: string; extraHeaders?: Record<string, string> };
}
export interface AppSummary {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  visibility: Visibility;
  status: 'draft' | 'deployed';
  pageCount: number;
  owner: { id: string; name: string; email: string };
  canEdit: boolean;
  updatedAt: string;
}
export interface AppFull {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  visibility: Visibility;
  status: 'draft' | 'deployed';
  version: number;
  hasUnpublishedChanges: boolean;
  definition: AppDefinition;
  aiConfig?: AppAiConfig;
  owner: { id: string; name: string; email: string };
  members?: { email: string; role: 'owner' | 'editor' | 'viewer' }[];
  myRole: string;
  canEdit: boolean;
  deployedAt?: string | null;
  updatedAt: string;
}
export interface TemplateSummary {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  pageCount: number;
}
export interface OrgMember {
  email: string;
  name: string;
  source: 'graph' | 'platform' | 'mock';
}
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  avatarUrl?: string | null;
  createdAt: string;
}
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
export interface ConversationSummary {
  id: string;
  title: string;
  pageId?: string | null;
  messageCount: number;
  updatedAt: string;
}
export interface ConversationDetail {
  id: string;
  title: string;
  pageId?: string | null;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

function errMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    return e.message;
  }
  return (e as Error).message ?? 'Unknown error';
}

export const api = {
  errMessage,

  // auth
  authConfig: () => http.get<AuthConfig>('/auth/config').then((r) => r.data),
  me: () => http.get<{ user: AuthUser | null }>('/auth/me').then((r) => r.data.user),
  devUsers: () => http.get<AdminUser[]>('/auth/dev-users').then((r) => r.data),
  devLogin: (email: string) => http.post<{ user: AuthUser }>('/auth/dev-login', { email }).then((r) => r.data.user),
  logout: () => http.post('/auth/logout').then((r) => r.data),

  // users (admin)
  listUsers: () => http.get<AdminUser[]>('/users').then((r) => r.data),
  updateUser: (id: string, body: { role?: Role; active?: boolean }) => http.patch(`/users/${id}`, body).then((r) => r.data),

  // org directory
  searchOrg: (q: string) => http.get<OrgMember[]>('/org/users', { params: { q } }).then((r) => r.data),

  // settings
  getSettings: () => http.get<PlatformSettings>('/settings').then((r) => r.data),
  updateSettings: (patch: Partial<PlatformSettings>) => http.put<PlatformSettings>('/settings', patch).then((r) => r.data),

  // templates
  listTemplates: () => http.get<TemplateSummary[]>('/templates').then((r) => r.data),
  createTemplate: (body: { name: string; description?: string; category?: string; definition: AppDefinition }) =>
    http.post<TemplateSummary>('/templates', body).then((r) => r.data),
  createTemplateFromApp: (appId: string, meta: { name?: string; description?: string; category?: string }) =>
    http.post<TemplateSummary>(`/templates/from-app/${appId}`, meta).then((r) => r.data),
  deleteTemplate: (id: string) => http.delete(`/templates/${id}`).then((r) => r.data),

  // data sources (per-app)
  listDataSources: (appId: string) => http.get<DataSource[]>(`/apps/${appId}/datasources`).then((r) => r.data),
  createDataSource: (appId: string, body: { name: string; type: DataSourceType; config: Record<string, unknown>; authMode?: DataSourceAuthMode }) =>
    http.post<DataSource>(`/apps/${appId}/datasources`, body).then((r) => r.data),
  updateDataSource: (appId: string, id: string, body: { name?: string; type?: DataSourceType; config?: Record<string, unknown>; authMode?: DataSourceAuthMode }) =>
    http.put<DataSource>(`/apps/${appId}/datasources/${id}`, body).then((r) => r.data),

  // per-user credentials (each user supplies their own secret for a per-user data source)
  listAppCredentials: (appId: string) => http.get<AppCredentialStatus[]>(`/apps/${appId}/credentials`).then((r) => r.data),
  setCredential: (appId: string, dataSourceId: string, config: Record<string, unknown>) =>
    http.put<{ dataSourceId: string; hasCredential: boolean }>(`/apps/${appId}/credentials/${dataSourceId}`, { config }).then((r) => r.data),
  deleteCredential: (appId: string, dataSourceId: string) =>
    http.delete(`/apps/${appId}/credentials/${dataSourceId}`).then((r) => r.data),
  deleteDataSource: (appId: string, id: string) => http.delete(`/apps/${appId}/datasources/${id}`).then((r) => r.data),
  testDataSource: (appId: string, id: string) =>
    http.post<{ ok: boolean; message: string }>(`/apps/${appId}/datasources/${id}/test`).then((r) => r.data),
  testInline: (appId: string, body: { name?: string; type: DataSourceType; config: Record<string, unknown> }) =>
    http.post<{ ok: boolean; message: string }>(`/apps/${appId}/datasources/test`, { name: body.name ?? 'test', ...body }).then((r) => r.data),

  // queries (per-app)
  listQueries: (appId: string) => http.get<QueryDef[]>(`/apps/${appId}/queries`).then((r) => r.data),
  createQuery: (appId: string, body: { name: string; dataSourceId: string; config: Record<string, unknown> }) =>
    http.post<QueryDef>(`/apps/${appId}/queries`, body).then((r) => r.data),
  updateQuery: (appId: string, id: string, body: { name?: string; dataSourceId?: string; config?: Record<string, unknown> }) =>
    http.put<QueryDef>(`/apps/${appId}/queries/${id}`, body).then((r) => r.data),
  deleteQuery: (appId: string, id: string) => http.delete(`/apps/${appId}/queries/${id}`).then((r) => r.data),
  runQuery: (appId: string, id: string) => http.post<ExecutionResult>(`/apps/${appId}/queries/${id}/run`).then((r) => r.data),
  runInline: (appId: string, body: { dataSourceId: string; config: Record<string, unknown> }) =>
    http.post<ExecutionResult>(`/apps/${appId}/queries/run`, body).then((r) => r.data),

  // connectors (prebuilt, admin-curated)
  listConnectors: () => http.get<Connector[]>('/connectors').then((r) => r.data),
  createConnector: (body: { name: string; description?: string; category?: string; type: DataSourceType; config: Record<string, unknown> }) =>
    http.post<Connector>('/connectors', body).then((r) => r.data),
  updateConnector: (id: string, body: Partial<{ name: string; description: string; category: string; type: DataSourceType; config: Record<string, unknown> }>) =>
    http.put<Connector>(`/connectors/${id}`, body).then((r) => r.data),
  deleteConnector: (id: string) => http.delete(`/connectors/${id}`).then((r) => r.data),
  addConnectorToApp: (appId: string, connectorId: string, name?: string) =>
    http.post<DataSource>(`/apps/${appId}/datasources/from-connector/${connectorId}`, { name }).then((r) => r.data),

  // ai
  aiStatus: () => http.get<AiStatus>('/ai/status').then((r) => r.data),
  /** App-scoped generation: uses the app's agent API / provider key / platform LLM + build guidelines. */
  generateUi: (appId: string, body: { prompt: string; sample: string; queryName?: string; currentHtml?: string; dataGuidance?: string; guidelines?: string }) =>
    http.post<GenerateUiResult>(`/apps/${appId}/generate-ui`, body).then((r) => r.data),

  // apps
  listMyApps: () => http.get<AppSummary[]>('/apps').then((r) => r.data),
  catalog: () => http.get<AppSummary[]>('/apps/catalog').then((r) => r.data),
  getApp: (id: string) => http.get<AppFull>(`/apps/${id}`).then((r) => r.data),
  getAppBySlug: (slug: string) => http.get<AppFull>(`/apps/by-slug/${slug}`).then((r) => r.data),
  createApp: (body: { name: string; description?: string; templateId?: string }) =>
    http.post<AppFull>('/apps', body).then((r) => r.data),
  updateApp: (id: string, body: { name?: string; description?: string; definition?: AppDefinition; aiConfig?: AppAiConfig }) =>
    http.put<AppFull>(`/apps/${id}`, body).then((r) => r.data),
  deleteApp: (id: string) => http.delete(`/apps/${id}`).then((r) => r.data),
  deployApp: (id: string, note?: string) => http.post<AppFull>(`/apps/${id}/deploy`, { note }).then((r) => r.data),
  undeployApp: (id: string) => http.post<AppFull>(`/apps/${id}/undeploy`).then((r) => r.data),
  listVersions: (id: string) => http.get<AppVersion[]>(`/apps/${id}/versions`).then((r) => r.data),
  rollbackApp: (id: string, version: number) => http.post<AppFull>(`/apps/${id}/rollback`, { version }).then((r) => r.data),
  setSharing: (id: string, body: { visibility: Visibility; members: { email: string; role: 'editor' | 'viewer' }[] }) =>
    http.put<AppFull>(`/apps/${id}/sharing`, body).then((r) => r.data),
  appPageData: (id: string, pageId: string) =>
    http.get<{ data: unknown; meta?: unknown }>(`/apps/${id}/pages/${pageId}/data`).then((r) => r.data),
  appRunQuery: (id: string, body: { queryId?: string; action?: string; pageId?: string; params?: Record<string, unknown> }) =>
    http.post<{ data: unknown; meta?: unknown }>(`/apps/${id}/run-query`, body).then((r) => r.data),
  // chat history (per-user threads, signed-in only)
  listConversations: (appId: string, pageId?: string) =>
    http.get<ConversationSummary[]>(`/apps/${appId}/conversations`, { params: pageId ? { pageId } : {} }).then((r) => r.data),
  getConversation: (appId: string, conversationId: string) =>
    http.get<ConversationDetail>(`/apps/${appId}/conversations/${conversationId}`).then((r) => r.data),
  deleteConversation: (appId: string, conversationId: string) =>
    http.delete(`/apps/${appId}/conversations/${conversationId}`).then((r) => r.data),

  chat: (id: string, body: { pageId?: string; messages: ChatMessage[]; conversationId?: string; persist?: boolean }) =>
    http.post<{ reply: string; source: string; conversationId?: string }>(`/apps/${id}/chat`, body).then((r) => r.data),

  /** Streaming chat: calls onDelta with each text chunk; resolves with the responder source + thread id. */
  chatStream: async (
    id: string,
    body: { pageId?: string; messages: ChatMessage[]; conversationId?: string; persist?: boolean },
    onDelta: (text: string) => void,
  ): Promise<{ source?: string; conversationId?: string }> => {
    const res = await fetch(`/api/apps/${id}/chat/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('uifactory:unauthorized'));
      throw new Error('Session expired');
    }
    if (!res.ok || !res.body) throw new Error(`Chat failed (${res.status})`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let source: string | undefined;
    let conversationId: string | undefined;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const obj = JSON.parse(line) as { delta?: string; done?: boolean; source?: string; error?: string; conversationId?: string };
        if (obj.error) throw new Error(obj.error);
        if (obj.delta) onDelta(obj.delta);
        if (obj.source) source = obj.source;
        if (obj.conversationId) conversationId = obj.conversationId;
      }
    }
    return { source, conversationId };
  },
};
