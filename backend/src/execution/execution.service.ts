import { Injectable, BadRequestException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { Client as PgClient } from 'pg';
// Node's built-in SQLite (experimental). Avoids native build steps.
import { DatabaseSync } from 'node:sqlite';
import { assertSafeUrl } from '../common/safe-url';
import {
  DataSourceType,
  ExecutionResult,
  PostgresConfig,
  RestConfig,
  RestQueryConfig,
  SqliteConfig,
  SqlQueryConfig,
} from './execution.types';

const REQUEST_TIMEOUT_MS = 20_000;

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
}
