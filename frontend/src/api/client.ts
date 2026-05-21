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
export type DataSourceType = 'REST' | 'POSTGRES' | 'SQLITE';
export type Role = 'admin' | 'member';
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
}
export interface PlatformSettings {
  platformName: string;
  defaultAiProvider: string;
  defaultAiModel: string;
  defaultVisibility: Visibility;
}

export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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
  source: 'ai' | 'fallback';
  provider?: AiProviderName;
  model?: string;
  note?: string;
}
export interface AiStatus {
  configured: boolean;
  provider: AiProviderName | null;
  model: string | null;
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
  chat?: { systemPrompt?: string; queryId?: string; greeting?: string };
  actions?: { name: string; queryId: string }[];
}
export interface AppDefinition {
  pages: AppPage[];
  theme?: Record<string, unknown>;
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

  // data sources
  listDataSources: () => http.get<DataSource[]>('/datasources').then((r) => r.data),
  createDataSource: (body: { name: string; type: DataSourceType; config: Record<string, unknown> }) =>
    http.post<DataSource>('/datasources', body).then((r) => r.data),
  deleteDataSource: (id: string) => http.delete(`/datasources/${id}`).then((r) => r.data),
  testDataSource: (id: string) => http.post<{ ok: boolean; message: string }>(`/datasources/${id}/test`).then((r) => r.data),
  testInline: (body: { name?: string; type: DataSourceType; config: Record<string, unknown> }) =>
    http.post<{ ok: boolean; message: string }>('/datasources/test', { name: body.name ?? 'test', ...body }).then((r) => r.data),

  // queries
  listQueries: (dataSourceId?: string) =>
    http.get<QueryDef[]>('/queries', { params: dataSourceId ? { dataSourceId } : {} }).then((r) => r.data),
  createQuery: (body: { name: string; dataSourceId: string; config: Record<string, unknown> }) =>
    http.post<QueryDef>('/queries', body).then((r) => r.data),
  runInline: (body: { dataSourceId: string; config: Record<string, unknown> }) =>
    http.post<ExecutionResult>('/queries/run', body).then((r) => r.data),

  // ai
  aiStatus: () => http.get<AiStatus>('/ai/status').then((r) => r.data),
  generateUi: (body: { prompt: string; sample: string; queryName?: string; currentHtml?: string }) =>
    http.post<GenerateUiResult>('/ai/generate-ui', body).then((r) => r.data),

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
  deployApp: (id: string) => http.post<AppFull>(`/apps/${id}/deploy`).then((r) => r.data),
  undeployApp: (id: string) => http.post<AppFull>(`/apps/${id}/undeploy`).then((r) => r.data),
  setSharing: (id: string, body: { visibility: Visibility; members: { email: string; role: 'editor' | 'viewer' }[] }) =>
    http.put<AppFull>(`/apps/${id}/sharing`, body).then((r) => r.data),
  appPageData: (id: string, pageId: string) =>
    http.get<{ data: unknown; meta?: unknown }>(`/apps/${id}/pages/${pageId}/data`).then((r) => r.data),
  appRunQuery: (id: string, body: { queryId?: string; action?: string; pageId?: string; params?: Record<string, unknown> }) =>
    http.post<{ data: unknown; meta?: unknown }>(`/apps/${id}/run-query`, body).then((r) => r.data),
  chat: (id: string, body: { pageId?: string; messages: ChatMessage[] }) =>
    http.post<{ reply: string; source: string }>(`/apps/${id}/chat`, body).then((r) => r.data),
};
