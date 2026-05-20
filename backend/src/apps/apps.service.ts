import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueriesService } from '../queries/queries.service';
import { CreateAppDto, UpdateAppDto } from './dto/app.dto';

@Injectable()
export class AppsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queries: QueriesService,
  ) {}

  private serialize(a: { id: string; name: string; definition: string; createdAt: Date; updatedAt: Date }) {
    return {
      id: a.id,
      name: a.name,
      definition: JSON.parse(a.definition) as Record<string, unknown>,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  async findAll() {
    const rows = await this.prisma.app.findMany({ orderBy: { updatedAt: 'desc' } });
    return rows.map((r) => this.serialize(r));
  }

  async findOne(id: string) {
    const row = await this.prisma.app.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`App ${id} not found`);
    return this.serialize(row);
  }

  async create(dto: CreateAppDto) {
    const row = await this.prisma.app.create({
      data: { name: dto.name, definition: JSON.stringify(dto.definition) },
    });
    return this.serialize(row);
  }

  async update(id: string, dto: UpdateAppDto) {
    await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.definition !== undefined) data.definition = JSON.stringify(dto.definition);
    const row = await this.prisma.app.update({ where: { id }, data });
    return this.serialize(row);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.app.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Re-run the app's bound query and return both the stored HTML and fresh data. */
  async runData(id: string) {
    const app = await this.findOne(id);
    const def = app.definition as { queryId?: string };
    if (!def.queryId) {
      return { data: null, note: 'This app has no bound query.' };
    }
    const result = await this.queries.run(def.queryId);
    return { data: result.data, meta: result.meta };
  }
}
