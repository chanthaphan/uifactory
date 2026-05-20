import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionService } from '../execution/execution.service';
import { DataSourcesService } from '../datasources/datasources.service';
import { CreateQueryDto, UpdateQueryDto } from './dto/query.dto';

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
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: q.id,
      name: q.name,
      dataSourceId: q.dataSourceId,
      config: JSON.parse(q.config) as Record<string, unknown>,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    };
  }

  async findAll(dataSourceId?: string) {
    const rows = await this.prisma.query.findMany({
      where: dataSourceId ? { dataSourceId } : undefined,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.serialize(r));
  }

  async findOne(id: string) {
    const row = await this.prisma.query.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Query ${id} not found`);
    return this.serialize(row);
  }

  async create(dto: CreateQueryDto) {
    await this.dataSources.findOne(dto.dataSourceId); // validates existence
    const row = await this.prisma.query.create({
      data: { name: dto.name, dataSourceId: dto.dataSourceId, config: JSON.stringify(dto.config) },
    });
    return this.serialize(row);
  }

  async update(id: string, dto: UpdateQueryDto) {
    await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.config !== undefined) data.config = JSON.stringify(dto.config);
    const row = await this.prisma.query.update({ where: { id }, data });
    return this.serialize(row);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.query.delete({ where: { id } });
    return { id, deleted: true };
  }

  async run(id: string) {
    const q = await this.findOne(id);
    const ds = await this.dataSources.getRaw(q.dataSourceId);
    return this.execution.run(ds.type, ds.parsedConfig, q.config);
  }

  async runInline(dataSourceId: string, config: Record<string, unknown>) {
    const ds = await this.dataSources.getRaw(dataSourceId);
    return this.execution.run(ds.type, ds.parsedConfig, config);
  }
}
