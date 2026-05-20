import axios from 'axios';

const http = axios.create({ baseURL: '/api' });

export type DataSourceType = 'REST' | 'POSTGRES' | 'SQLITE';

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
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionResult {
  data: unknown;
  meta: {
    type: DataSourceType;
    durationMs: number;
    status?: number;
    rowCount?: number;
    columns?: string[];
  };
}

export interface AppDef {
  id: string;
  name: string;
  definition: {
    html?: string;
    queryId?: string;
    prompt?: string;
    sample?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type AiProviderName = 'anthropic' | 'openai' | 'azure-openai';

export const PROVIDER_LABEL: Record<AiProviderName, string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  'azure-openai': 'Azure OpenAI',
};

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

  // Data sources
  listDataSources: () => http.get<DataSource[]>('/datasources').then((r) => r.data),
  createDataSource: (body: { name: string; type: DataSourceType; config: Record<string, unknown> }) =>
    http.post<DataSource>('/datasources', body).then((r) => r.data),
  updateDataSource: (id: string, body: Partial<{ name: string; type: DataSourceType; config: Record<string, unknown> }>) =>
    http.put<DataSource>(`/datasources/${id}`, body).then((r) => r.data),
  deleteDataSource: (id: string) => http.delete(`/datasources/${id}`).then((r) => r.data),
  testDataSource: (id: string) => http.post<{ ok: boolean; message: string }>(`/datasources/${id}/test`).then((r) => r.data),
  testInline: (body: { name?: string; type: DataSourceType; config: Record<string, unknown> }) =>
    http.post<{ ok: boolean; message: string }>('/datasources/test', { name: body.name ?? 'test', ...body }).then((r) => r.data),

  // Queries
  listQueries: (dataSourceId?: string) =>
    http.get<QueryDef[]>('/queries', { params: dataSourceId ? { dataSourceId } : {} }).then((r) => r.data),
  createQuery: (body: { name: string; dataSourceId: string; config: Record<string, unknown> }) =>
    http.post<QueryDef>('/queries', body).then((r) => r.data),
  updateQuery: (id: string, body: Partial<{ name: string; config: Record<string, unknown> }>) =>
    http.put<QueryDef>(`/queries/${id}`, body).then((r) => r.data),
  deleteQuery: (id: string) => http.delete(`/queries/${id}`).then((r) => r.data),
  runQuery: (id: string) => http.post<ExecutionResult>(`/queries/${id}/run`).then((r) => r.data),
  runInline: (body: { dataSourceId: string; config: Record<string, unknown> }) =>
    http.post<ExecutionResult>('/queries/run', body).then((r) => r.data),

  // AI
  aiStatus: () => http.get<AiStatus>('/ai/status').then((r) => r.data),
  generateUi: (body: { prompt: string; sample: string; queryName?: string }) =>
    http.post<GenerateUiResult>('/ai/generate-ui', body).then((r) => r.data),

  // Apps
  listApps: () => http.get<AppDef[]>('/apps').then((r) => r.data),
  getApp: (id: string) => http.get<AppDef>(`/apps/${id}`).then((r) => r.data),
  getAppData: (id: string) => http.get<{ data: unknown; meta?: unknown; note?: string }>(`/apps/${id}/data`).then((r) => r.data),
  createApp: (body: { name: string; definition: AppDef['definition'] }) =>
    http.post<AppDef>('/apps', body).then((r) => r.data),
  updateApp: (id: string, body: Partial<{ name: string; definition: AppDef['definition'] }>) =>
    http.put<AppDef>(`/apps/${id}`, body).then((r) => r.data),
  deleteApp: (id: string) => http.delete(`/apps/${id}`).then((r) => r.data),
};
