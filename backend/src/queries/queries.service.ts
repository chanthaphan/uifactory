import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionService } from '../execution/execution.service';
import { DataSourcesService } from '../datasources/datasources.service';
import { AppAccessService } from '../apps/app-access.service';
import { CreateQueryDto, UpdateQueryDto } from './dto/query.dto';
import { LIMITS } from '../common/limits';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class QueriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly execution: ExecutionService,
    private readonly dataSources: DataSourcesService,
    private readonly access: AppAccessService,
  ) {}

  private serialize(q: {
    id: string;
    name: string;
    dataSourceId: string;
    appId: string;
    config: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: q.id,
      name: q.name,
      dataSourceId: q.dataSourceId,
      appId: q.appId,
      config: JSON.parse(q.config) as Record<string, unknown>,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    };
  }

  /** Ensure a data source exists and belongs to the given app. */
  private async assertDataSourceInApp(dataSourceId: string, appId: string) {
    const ds = await this.prisma.dataSource.findUnique({ where: { id: dataSourceId }, select: { appId: true } });
    if (!ds) throw new NotFoundException('Data source not found');
    if (ds.appId !== appId) throw new BadRequestException('Data source belongs to a different app');
  }

  async findAll(appId: string, user: AuthUser) {
    await this.access.assertCanView(appId, user);
    const rows = await this.prisma.query.findMany({ where: { appId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.serialize(r));
  }

  async findOne(id: string, user: AuthUser) {
    const row = await this.prisma.query.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Query ${id} not found`);
    await this.access.assertCanView(row.appId, user);
    return this.serialize(row);
  }

  async create(appId: string, dto: CreateQueryDto, user: AuthUser) {
    await this.access.assertCanEdit(appId, user);
    const count = await this.prisma.query.count({ where: { appId } });
    if (count >= LIMITS.maxQueriesPerApp) {
      throw new BadRequestException(`This app already has the maximum of ${LIMITS.maxQueriesPerApp} queries.`);
    }
    await this.assertDataSourceInApp(dto.dataSourceId, appId);
    const row = await this.prisma.query.create({
      data: { name: dto.name, dataSourceId: dto.dataSourceId, appId, config: JSON.stringify(dto.config) },
    });
    return this.serialize(row);
  }

  private async assertCanManage(id: string, user: AuthUser) {
    const row = await this.prisma.query.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Query ${id} not found`);
    await this.access.assertCanEdit(row.appId, user);
    return row;
  }

  async update(id: string, dto: UpdateQueryDto, user: AuthUser) {
    const row = await this.assertCanManage(id, user);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.config !== undefined) data.config = JSON.stringify(dto.config);
    if (dto.dataSourceId !== undefined) {
      await this.assertDataSourceInApp(dto.dataSourceId, row.appId);
      data.dataSourceId = dto.dataSourceId;
    }
    const updated = await this.prisma.query.update({ where: { id }, data });
    return this.serialize(updated);
  }

  async remove(id: string, user: AuthUser) {
    await this.assertCanManage(id, user);
    await this.prisma.query.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Editor "Run query" in the data panel. */
  async runChecked(id: string, user: AuthUser, params?: Record<string, unknown>) {
    const row = await this.assertCanManage(id, user);
    return this.runInternal(row, params);
  }

  /** Editor ad-hoc run against one of the app's data sources. */
  async runInline(appId: string, dataSourceId: string, config: Record<string, unknown>, user: AuthUser) {
    await this.access.assertCanEdit(appId, user);
    await this.assertDataSourceInApp(dataSourceId, appId);
    const ds = await this.dataSources.getRaw(dataSourceId);
    return this.execution.run(ds.type, ds.parsedConfig, config);
  }

  /** Internal run used by the app runtime (access enforced at the app layer). */
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
