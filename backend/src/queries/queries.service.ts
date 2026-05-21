import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionService } from '../execution/execution.service';
import { DataSourcesService } from '../datasources/datasources.service';
import { CreateQueryDto, UpdateQueryDto } from './dto/query.dto';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class QueriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly execution: ExecutionService,
    private readonly dataSources: DataSourcesService,
  ) {}

  private serialize(q: {
    id: string;
    name: string;
    dataSourceId: string;
    config: string;
    ownerId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: q.id,
      name: q.name,
      dataSourceId: q.dataSourceId,
      config: JSON.parse(q.config) as Record<string, unknown>,
      ownerId: q.ownerId,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    };
  }

  /** List queries whose data source the user is allowed to use. */
  async findAll(user: AuthUser, dataSourceId?: string) {
    const accessible = await this.dataSources.accessibleIds(user);
    const ids = dataSourceId ? accessible.filter((id) => id === dataSourceId) : accessible;
    const rows = await this.prisma.query.findMany({ where: { dataSourceId: { in: ids } }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.serialize(r));
  }

  async findOne(id: string, user: AuthUser) {
    const row = await this.prisma.query.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Query ${id} not found`);
    await this.dataSources.assertCanUse(row.dataSourceId, user);
    return this.serialize(row);
  }

  async create(dto: CreateQueryDto, user: AuthUser) {
    await this.dataSources.assertCanUse(dto.dataSourceId, user);
    const row = await this.prisma.query.create({
      data: { name: dto.name, dataSourceId: dto.dataSourceId, config: JSON.stringify(dto.config), ownerId: user.id },
    });
    return this.serialize(row);
  }

  private async assertCanManage(id: string, user: AuthUser) {
    const row = await this.prisma.query.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Query ${id} not found`);
    const ds = await this.dataSources.assertCanUse(row.dataSourceId, user);
    const canManage = user.role === 'admin' || row.ownerId === user.id || ds.ownerId === user.id;
    if (!canManage) throw new ForbiddenException('You cannot modify this query');
    return row;
  }

  async update(id: string, dto: UpdateQueryDto, user: AuthUser) {
    await this.assertCanManage(id, user);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.config !== undefined) data.config = JSON.stringify(dto.config);
    const row = await this.prisma.query.update({ where: { id }, data });
    return this.serialize(row);
  }

  async remove(id: string, user: AuthUser) {
    await this.assertCanManage(id, user);
    await this.prisma.query.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Run a saved query, enforcing the caller can use its data source. */
  async runChecked(id: string, user: AuthUser, params?: Record<string, unknown>) {
    const q = await this.prisma.query.findUnique({ where: { id } });
    if (!q) throw new NotFoundException(`Query ${id} not found`);
    await this.dataSources.assertCanUse(q.dataSourceId, user);
    return this.runInternal(q, params);
  }

  /** Run an ad-hoc query against a data source the caller can use. */
  async runInline(dataSourceId: string, config: Record<string, unknown>, user: AuthUser) {
    const ds = await this.dataSources.getRaw(dataSourceId, user);
    return this.execution.run(ds.type, ds.parsedConfig, config);
  }

  /** Internal run used by the app runtime (access already enforced at the app layer). */
  async run(id: string, params?: Record<string, unknown>) {
    const q = await this.prisma.query.findUnique({ where: { id } });
    if (!q) throw new NotFoundException(`Query ${id} not found`);
    return this.runInternal(q, params);
  }

  private async runInternal(q: { dataSourceId: string; config: string }, params?: Record<string, unknown>) {
    const ds = await this.dataSources.getRaw(q.dataSourceId);
    const config = JSON.parse(q.config) as Record<string, unknown>;
    return this.execution.run(ds.type, ds.parsedConfig, config, params);
  }
}
