import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionService } from '../execution/execution.service';
import { CreateDataSourceDto, UpdateDataSourceDto } from './dto/datasource.dto';
import { DataSourceType } from '../execution/execution.types';
import { AuthUser } from '../auth/auth.types';
import { decryptString, encryptString } from '../common/crypto.util';

/** Keys considered sensitive and redacted before returning a data source to the client. */
const SENSITIVE_KEYS = ['connectionString', 'password', 'authorization', 'apiKey', 'token'];

function redactConfig(config: Record<string, unknown>): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...config };
  for (const key of Object.keys(clone)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase() === s.toLowerCase()) && typeof clone[key] === 'string') {
      const val = clone[key] as string;
      clone[key] = val.length > 6 ? `${val.slice(0, 3)}***${val.slice(-2)}` : '***';
    }
  }
  if (clone.headers && typeof clone.headers === 'object') {
    const headers = { ...(clone.headers as Record<string, string>) };
    for (const h of Object.keys(headers)) {
      if (h.toLowerCase() === 'authorization' || h.toLowerCase().includes('key') || h.toLowerCase().includes('token')) {
        headers[h] = '***';
      }
    }
    clone.headers = headers;
  }
  return clone;
}

type DsRow = {
  id: string;
  name: string;
  type: string;
  config: string;
  ownerId: string | null;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class DataSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly execution: ExecutionService,
  ) {}

  private parseConfig(ds: DsRow): Record<string, unknown> {
    return JSON.parse(decryptString(ds.config)) as Record<string, unknown>;
  }

  private serialize(ds: DsRow) {
    return {
      id: ds.id,
      name: ds.name,
      type: ds.type as DataSourceType,
      config: redactConfig(this.parseConfig(ds)),
      ownerId: ds.ownerId,
      visibility: ds.visibility,
      createdAt: ds.createdAt,
      updatedAt: ds.updatedAt,
    };
  }

  private canUse(ds: { ownerId: string | null; visibility: string }, user: AuthUser): boolean {
    return ds.ownerId === user.id || ds.visibility === 'org' || user.role === 'admin' || ds.ownerId == null;
  }
  private canManage(ds: { ownerId: string | null }, user: AuthUser): boolean {
    return ds.ownerId === user.id || user.role === 'admin' || ds.ownerId == null;
  }

  /** IDs of data sources the user is allowed to use (for query listing/binding). */
  async accessibleIds(user: AuthUser): Promise<string[]> {
    const rows = await this.prisma.dataSource.findMany({ select: { id: true, ownerId: true, visibility: true } });
    return rows.filter((r) => this.canUse(r, user)).map((r) => r.id);
  }

  /** Throws unless the user may use this data source; returns its owner/visibility. */
  async assertCanUse(id: string, user: AuthUser) {
    const row = await this.prisma.dataSource.findUnique({ where: { id }, select: { id: true, ownerId: true, visibility: true } });
    if (!row) throw new NotFoundException(`Data source ${id} not found`);
    if (!this.canUse(row, user)) throw new ForbiddenException('No access to this data source');
    return row;
  }

  async findAll(user: AuthUser) {
    const rows = await this.prisma.dataSource.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.filter((r) => this.canUse(r, user)).map((r) => this.serialize(r));
  }

  async findOne(id: string, user: AuthUser) {
    const row = await this.prisma.dataSource.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Data source ${id} not found`);
    if (!this.canUse(row, user)) throw new ForbiddenException('No access to this data source');
    return this.serialize(row);
  }

  /** Internal: raw (decrypted) config for execution. Optionally enforces the user can use it. */
  async getRaw(id: string, user?: AuthUser) {
    const row = await this.prisma.dataSource.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Data source ${id} not found`);
    if (user && !this.canUse(row, user)) throw new ForbiddenException('No access to this data source');
    return { ...row, parsedConfig: this.parseConfig(row), type: row.type as DataSourceType };
  }

  async create(dto: CreateDataSourceDto, user: AuthUser) {
    const row = await this.prisma.dataSource.create({
      data: {
        name: dto.name,
        type: dto.type,
        config: encryptString(JSON.stringify(dto.config)),
        ownerId: user.id,
        visibility: dto.visibility === 'private' ? 'private' : 'org',
      },
    });
    return this.serialize(row);
  }

  async update(id: string, dto: UpdateDataSourceDto, user: AuthUser) {
    const row = await this.prisma.dataSource.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Data source ${id} not found`);
    if (!this.canManage(row, user)) throw new ForbiddenException('Only the owner or an admin can edit this data source');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.config !== undefined) data.config = encryptString(JSON.stringify(dto.config));
    if (dto.visibility !== undefined) data.visibility = dto.visibility === 'private' ? 'private' : 'org';
    const updated = await this.prisma.dataSource.update({ where: { id }, data });
    return this.serialize(updated);
  }

  async remove(id: string, user: AuthUser) {
    const row = await this.prisma.dataSource.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Data source ${id} not found`);
    if (!this.canManage(row, user)) throw new ForbiddenException('Only the owner or an admin can delete this data source');
    await this.prisma.dataSource.delete({ where: { id } });
    return { id, deleted: true };
  }

  async test(id: string, user: AuthUser) {
    const ds = await this.getRaw(id, user);
    return this.execution.test(ds.type, ds.parsedConfig);
  }

  async testInline(type: DataSourceType, config: Record<string, unknown>) {
    return this.execution.test(type, config);
  }
}
