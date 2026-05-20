export type DataSourceType = 'REST' | 'POSTGRES' | 'SQLITE';

export interface RestConfig {
  baseUrl: string;
  headers?: Record<string, string>;
}

export interface PostgresConfig {
  connectionString: string;
}

export interface SqliteConfig {
  file: string;
}

export interface RestQueryConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface SqlQueryConfig {
  sql: string;
}

export interface ExecutionResult {
  /** The primary payload: for REST it's the response body; for SQL it's an array of rows. */
  data: unknown;
  /** Metadata describing the execution, useful for the UI and AI prompt. */
  meta: {
    type: DataSourceType;
    durationMs: number;
    /** REST only */
    status?: number;
    /** SQL only */
    rowCount?: number;
    columns?: string[];
  };
}
