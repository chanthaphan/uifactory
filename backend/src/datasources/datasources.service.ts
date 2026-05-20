import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionService } from '../execution/execution.service';
import { CreateDataSourceDto, UpdateDataSourceDto } from './dto/datasource.dto';
import { DataSourceType } from '../execution/execution.types';

/** Keys considered sensitive and redacted before returning a data source to the client. */
const SENSITIVE_KEYS = ['connectionString', 'password', 'authorization', 'apiKey', 'token'];

function redactConfig(type: string, config: Record<string, unknown>): Record<string, unknown> {
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

@Injectable()
export class DataSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly execution: ExecutionService,
  ) {}

  private serialize(ds: { id: string; name: string; type: string; config: string; createdAt: Date; updatedAt: Date }) {
    const config = JSON.parse(ds.config) as Record<string, unknown>;
    return {
      id: ds.id,
      name: ds.name,
      type: ds.type as DataSourceType,
      config: redactConfig(ds.type, config),
      createdAt: ds.createdAt,
      updatedAt: ds.updatedAt,
    };
  }

  async findAll() {
    const rows = await this.prisma.dataSource.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.serialize(r));
  }

  async findOne(id: string) {
    const row = await this.prisma.dataSource.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Data source ${id} not found`);
    return this.serialize(row);
  }

  /** Internal: returns the raw (unredacted) config for execution. */
  async getRaw(id: string) {
    const row = await this.prisma.dataSource.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Data source ${id} not found`);
    return { ...row, parsedConfig: JSON.parse(row.config) as Record<string, unknown>, type: row.type as DataSourceType };
  }

  async create(dto: CreateDataSourceDto) {
    const row = await this.prisma.dataSource.create({
      data: { name: dto.name, type: dto.type, config: JSON.stringify(dto.config) },
    });
    return this.serialize(row);
  }

  async update(id: string, dto: UpdateDataSourceDto) {
    await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.config !== undefined) data.config = JSON.stringify(dto.config);
    const row = await this.prisma.dataSource.update({ where: { id }, data });
    return this.serialize(row);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.dataSource.delete({ where: { id } });
    return { id, deleted: true };
  }

  async test(id: string) {
    const ds = await this.getRaw(id);
    return this.execution.test(ds.type, ds.parsedConfig);
  }

  /** Test an unsaved config (used by the create dialog). */
  async testInline(type: DataSourceType, config: Record<string, unknown>) {
    return this.execution.test(type, config);
  }
}
