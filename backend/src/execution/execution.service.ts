import { Injectable, BadRequestException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { Client as PgClient } from 'pg';
// Node's built-in SQLite (experimental). Avoids native build steps.
import { DatabaseSync } from 'node:sqlite';
import { assertSafeUrl } from '../common/safe-url';
import {
  DataSourceType,
  ExecutionResult,
  MsGraphQueryConfig,
  PostgresConfig,
  RestConfig,
  RestQueryConfig,
  SqliteConfig,
  SqlQueryConfig,
} from './execution.types';

const REQUEST_TIMEOUT_MS = 20_000;
const GRAPH = 'https://graph.microsoft.com/v1.0';

@Injectable()
export class ExecutionService {
  /**
   * Run a query (queryConfig) against a data source (dsConfig) of a given type.
   * Configs are passed as parsed objects.
   */
  async run(
    type: DataSourceType,
    dsConfig: Record<string, unknown>,
    queryConfig: Record<string, unknown>,
    params?: Record<string, unknown>,
  ): Promise<ExecutionResult> {
    const started = Date.now();
    switch (type) {
      case 'REST':
        return this.runRest(dsConfig as unknown as RestConfig, queryConfig as unknown as RestQueryConfig, started, params);
      case 'POSTGRES':
        return this.runPostgres(dsConfig as unknown as PostgresConfig, queryConfig as unknown as SqlQueryConfig, started, params);
      case 'SQLITE':
        return this.runSqlite(dsConfig as unknown as SqliteConfig, queryConfig as unknown as SqlQueryConfig, started, params);
      case 'MSGRAPH':
        return this.runGraph(queryConfig as unknown as MsGraphQueryConfig, started, params);
      default:
        throw new BadRequestException(`Unsupported data source type: ${type}`);
    }
  }

  /** Replace {{name}} placeholders with positional params, returning the rewritten SQL + values. */
  private bindSql(sql: string, params: Record<string, unknown> | undefined, dialect: 'pg' | 'sqlite') {
    const values: unknown[] = [];
    let i = 0;
    const text = sql.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, name: string) => {
      values.push(params?.[name] ?? null);
      return dialect === 'pg' ? `$${++i}` : '?';
    });
    return { text, values };
  }

  /** Substitute {{name}} placeholders inside an arbitrary string (path/body/headers). */
  private fill(template: string, params?: Record<string, unknown>): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, name: string) => {
      const v = params?.[name];
      return v == null ? '' : String(v);
    });
  }

  /** Lightweight connectivity check used by the "Test connection" button. */
  async test(type: DataSourceType, dsConfig: Record<string, unknown>): Promise<{ ok: true; message: string }> {
    switch (type) {
      case 'REST': {
        const cfg = dsConfig as unknown as RestConfig;
        if (!cfg.baseUrl) throw new BadRequestException('REST data source requires a baseUrl');
        let origin: string;
        try {
          origin = new URL(cfg.baseUrl).origin;
        } catch {
          throw new BadRequestException('baseUrl is not a valid URL');
        }
        await assertSafeUrl(cfg.baseUrl);
        return { ok: true, message: `Base URL looks valid (${origin})` };
      }
      case 'POSTGRES': {
        const cfg = dsConfig as unknown as PostgresConfig;
        const client = new PgClient({ connectionString: cfg.connectionString, connectionTimeoutMillis: REQUEST_TIMEOUT_MS });
        try {
          await client.connect();
          await client.query('SELECT 1');
          return { ok: true, message: 'Connected to PostgreSQL successfully' };
        } catch (err) {
          throw new BadRequestException(`PostgreSQL connection failed: ${(err as Error).message}`);
        } finally {
          await client.end().catch(() => undefined);
        }
      }
      case 'SQLITE': {
        const cfg = dsConfig as unknown as SqliteConfig;
        let db: DatabaseSync | undefined;
        try {
          db = new DatabaseSync(cfg.file, { readOnly: true });
          db.prepare('SELECT 1').get();
          return { ok: true, message: `Opened SQLite file (${cfg.file})` };
        } catch (err) {
          throw new BadRequestException(`SQLite open failed: ${(err as Error).message}`);
        } finally {
          db?.close();
        }
      }
      case 'MSGRAPH': {
        if (!this.graphConfigured()) {
          return { ok: true, message: 'Microsoft 365 connector ready (dev mock — set AZURE_AD_* for live Graph)' };
        }
        try {
          await this.getGraphToken();
          return { ok: true, message: 'Acquired a Microsoft Graph app token successfully' };
        } catch (err) {
          throw new BadRequestException(`Microsoft Graph auth failed: ${(err as Error).message}`);
        }
      }
      default:
        throw new BadRequestException(`Unsupported data source type: ${type}`);
    }
  }

  private async runRest(ds: RestConfig, q: RestQueryConfig, started: number, params?: Record<string, unknown>): Promise<ExecutionResult> {
    if (!ds.baseUrl) throw new BadRequestException('REST data source requires a baseUrl');
    const base = ds.baseUrl.replace(/\/+$/, '');
    const path = this.fill((q.path || '').trim(), params);
    const url = path ? `${base}/${path.replace(/^\/+/, '')}` : base;

    let body = q.body ?? undefined;
    if (body !== undefined && params) {
      try {
        body = JSON.parse(this.fill(JSON.stringify(body), params));
      } catch {
        /* leave body as-is if it isn't JSON-templatable */
      }
    }

    await assertSafeUrl(url);
    try {
      const res = await axios.request({
        url,
        method: q.method || 'GET',
        headers: { ...(ds.headers || {}), ...(q.headers || {}) },
        data: body,
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true,
      });
      return {
        data: res.data,
        meta: { type: 'REST', durationMs: Date.now() - started, status: res.status },
      };
    } catch (err) {
      const ax = err as AxiosError;
      throw new BadRequestException(`REST request failed: ${ax.message}`);
    }
  }

  private async runPostgres(ds: PostgresConfig, q: SqlQueryConfig, started: number, params?: Record<string, unknown>): Promise<ExecutionResult> {
    if (!q.sql) throw new BadRequestException('SQL query is empty');
    const client = new PgClient({ connectionString: ds.connectionString, connectionTimeoutMillis: REQUEST_TIMEOUT_MS });
    try {
      await client.connect();
      const { text, values } = this.bindSql(q.sql, params, 'pg');
      const res = await client.query(text, values);
      return {
        data: res.rows,
        meta: {
          type: 'POSTGRES',
          durationMs: Date.now() - started,
          rowCount: res.rowCount ?? res.rows.length,
          columns: res.fields?.map((f) => f.name) ?? [],
        },
      };
    } catch (err) {
      throw new BadRequestException(`PostgreSQL query failed: ${(err as Error).message}`);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  private async runSqlite(ds: SqliteConfig, q: SqlQueryConfig, started: number, params?: Record<string, unknown>): Promise<ExecutionResult> {
    if (!q.sql) throw new BadRequestException('SQL query is empty');
    let db: DatabaseSync | undefined;
    try {
      db = new DatabaseSync(ds.file);
      const { text, values } = this.bindSql(q.sql, params, 'sqlite');
      const isSelect = /^\s*(select|with|pragma)/i.test(q.sql);
      if (isSelect) {
        const rows = db.prepare(text).all(...(values as never[]));
        const columns = rows.length ? Object.keys(rows[0] as object) : [];
        return {
          data: rows,
          meta: { type: 'SQLITE', durationMs: Date.now() - started, rowCount: rows.length, columns },
        };
      }
      const info = db.prepare(text).run(...(values as never[]));
      return {
        data: { changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) },
        meta: { type: 'SQLITE', durationMs: Date.now() - started, rowCount: Number(info.changes) },
      };
    } catch (err) {
      throw new BadRequestException(`SQLite query failed: ${(err as Error).message}`);
    } finally {
      db?.close();
    }
  }

  // ---- Microsoft 365 / Graph (app-only) ----

  private graphToken?: { value: string; expiresAt: number };

  private graphConfigured(): boolean {
    return Boolean(process.env.AZURE_AD_TENANT_ID && process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET);
  }

  private async getGraphToken(): Promise<string> {
    if (this.graphToken && this.graphToken.expiresAt > Date.now() + 60_000) return this.graphToken.value;
    const body = new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID!,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default',
    });
    const res = await axios.post(
      `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: REQUEST_TIMEOUT_MS },
    );
    this.graphToken = { value: res.data.access_token, expiresAt: Date.now() + res.data.expires_in * 1000 };
    return this.graphToken.value;
  }

  private async runGraph(q: MsGraphQueryConfig, started: number, params?: Record<string, unknown>): Promise<ExecutionResult> {
    if (!q.path) throw new BadRequestException('Microsoft 365 query requires a Graph path (e.g. "users")');
    const path = this.fill(q.path.replace(/^\/+/, ''), params);

    if (!this.graphConfigured()) {
      // Dev fallback so the connector works offline without an Azure tenant.
      return { data: mockGraph(path), meta: { type: 'MSGRAPH', durationMs: Date.now() - started } };
    }
    const token = await this.getGraphToken();
    const res = await axios.request({
      url: `${GRAPH}/${path}`,
      method: q.method || 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ConsistencyLevel: 'eventual' },
      data: q.body ?? undefined,
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });
    if (res.status >= 400) throw new BadRequestException(`Microsoft Graph returned ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`);
    return { data: res.data, meta: { type: 'MSGRAPH', durationMs: Date.now() - started, status: res.status } };
  }
}

/** Mock Microsoft Graph responses for common paths (used when Azure is not configured). */
function mockGraph(path: string): unknown {
  const p = path.toLowerCase();
  if (p.startsWith('me/messages') || p.endsWith('/messages') || p.includes('messages')) {
    return { value: [
      { id: 'AAMk01', from: 'priya.nair@contoso.com', subject: 'Q3 budget review', receivedDateTime: '2026-05-20T09:12:00Z', isRead: false },
      { id: 'AAMk02', from: 'tom.becker@contoso.com', subject: 'Re: Vendor contract', receivedDateTime: '2026-05-20T08:40:00Z', isRead: true },
      { id: 'AAMk03', from: 'no-reply@github.com', subject: 'CI passed on main', receivedDateTime: '2026-05-19T22:05:00Z', isRead: true },
    ] };
  }
  if (p.startsWith('me/events') || p.includes('events') || p.includes('calendar')) {
    return { value: [
      { id: 'evt1', subject: 'Sprint planning', start: '2026-05-21T15:00:00Z', end: '2026-05-21T16:00:00Z', organizer: 'sara.lopez@contoso.com' },
      { id: 'evt2', subject: '1:1 with manager', start: '2026-05-22T17:30:00Z', end: '2026-05-22T18:00:00Z', organizer: 'manager@contoso.com' },
    ] };
  }
  if (p.startsWith('groups')) {
    return { value: [
      { id: 'g1', displayName: 'Finance', mail: 'finance@contoso.com' },
      { id: 'g2', displayName: 'Engineering', mail: 'eng@contoso.com' },
      { id: 'g3', displayName: 'Sales', mail: 'sales@contoso.com' },
    ] };
  }
  if (p === 'me') {
    return { id: 'me-1', displayName: 'Platform Admin', mail: 'admin@contoso.com', jobTitle: 'Operations Lead' };
  }
  // default: users
  return { value: [
    { id: 'u1', displayName: 'Priya Nair', mail: 'priya.nair@contoso.com', jobTitle: 'Analyst', department: 'Finance' },
    { id: 'u2', displayName: 'Tom Becker', mail: 'tom.becker@contoso.com', jobTitle: 'Engineer', department: 'Engineering' },
    { id: 'u3', displayName: 'Sara Lopez', mail: 'sara.lopez@contoso.com', jobTitle: 'AE', department: 'Sales' },
    { id: 'u4', displayName: 'Kenji Watanabe', mail: 'kenji.watanabe@contoso.com', jobTitle: 'PM', department: 'Product' },
  ] };
}
