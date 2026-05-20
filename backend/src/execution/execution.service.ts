import { Injectable, BadRequestException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { Client as PgClient } from 'pg';
// Node's built-in SQLite (experimental). Avoids native build steps.
import { DatabaseSync } from 'node:sqlite';
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
  ): Promise<ExecutionResult> {
    const started = Date.now();
    switch (type) {
      case 'REST':
        return this.runRest(dsConfig as unknown as RestConfig, queryConfig as unknown as RestQueryConfig, started);
      case 'POSTGRES':
        return this.runPostgres(dsConfig as unknown as PostgresConfig, queryConfig as unknown as SqlQueryConfig, started);
      case 'SQLITE':
        return this.runSqlite(dsConfig as unknown as SqliteConfig, queryConfig as unknown as SqlQueryConfig, started);
      default:
        throw new BadRequestException(`Unsupported data source type: ${type}`);
    }
  }

  /** Lightweight connectivity check used by the "Test connection" button. */
  async test(type: DataSourceType, dsConfig: Record<string, unknown>): Promise<{ ok: true; message: string }> {
    switch (type) {
      case 'REST': {
        const cfg = dsConfig as unknown as RestConfig;
        if (!cfg.baseUrl) throw new BadRequestException('REST data source requires a baseUrl');
        try {
          const url = new URL(cfg.baseUrl);
          return { ok: true, message: `Base URL looks valid (${url.origin})` };
        } catch {
          throw new BadRequestException('baseUrl is not a valid URL');
        }
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

  private async runRest(ds: RestConfig, q: RestQueryConfig, started: number): Promise<ExecutionResult> {
    if (!ds.baseUrl) throw new BadRequestException('REST data source requires a baseUrl');
    const base = ds.baseUrl.replace(/\/+$/, '');
    const path = (q.path || '').trim();
    const url = path ? `${base}/${path.replace(/^\/+/, '')}` : base;

    try {
      const res = await axios.request({
        url,
        method: q.method || 'GET',
        headers: { ...(ds.headers || {}), ...(q.headers || {}) },
        data: q.body ?? undefined,
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

  private async runPostgres(ds: PostgresConfig, q: SqlQueryConfig, started: number): Promise<ExecutionResult> {
    if (!q.sql) throw new BadRequestException('SQL query is empty');
    const client = new PgClient({ connectionString: ds.connectionString, connectionTimeoutMillis: REQUEST_TIMEOUT_MS });
    try {
      await client.connect();
      const res = await client.query(q.sql);
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

  private async runSqlite(ds: SqliteConfig, q: SqlQueryConfig, started: number): Promise<ExecutionResult> {
    if (!q.sql) throw new BadRequestException('SQL query is empty');
    let db: DatabaseSync | undefined;
    try {
      db = new DatabaseSync(ds.file);
      const isSelect = /^\s*(select|with|pragma)/i.test(q.sql);
      if (isSelect) {
        const rows = db.prepare(q.sql).all();
        const columns = rows.length ? Object.keys(rows[0] as object) : [];
        return {
          data: rows,
          meta: { type: 'SQLITE', durationMs: Date.now() - started, rowCount: rows.length, columns },
        };
      }
      const info = db.prepare(q.sql).run();
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
