import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeDefinition } from '../apps/app-defs';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(t: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    definition: string;
    createdAt: Date;
  }) {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      pageCount: normalizeDefinition(JSON.parse(t.definition)).pages.length,
      createdAt: t.createdAt,
    };
  }

  async findAll() {
    const rows = await this.prisma.template.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.serialize(r));
  }

  async create(dto: { name: string; description?: string; category?: string; definition: Record<string, unknown> }, user: AuthUser) {
    const row = await this.prisma.template.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        definition: JSON.stringify(normalizeDefinition(dto.definition)),
        createdById: user.id,
      },
    });
    return this.serialize(row);
  }

  async createFromApp(appId: string, meta: { name?: string; description?: string; category?: string }, user: AuthUser) {
    const app = await this.prisma.app.findUnique({ where: { id: appId } });
    if (!app) throw new NotFoundException('App not found');
    const row = await this.prisma.template.create({
      data: {
        name: meta.name || `${app.name} (template)`,
        description: meta.description ?? app.description,
        category: meta.category,
        definition: JSON.stringify(normalizeDefinition(JSON.parse(app.definition))),
        createdById: user.id,
      },
    });
    return this.serialize(row);
  }

  async remove(id: string) {
    const tpl = await this.prisma.template.findUnique({ where: { id } });
    if (!tpl) throw new NotFoundException('Template not found');
    await this.prisma.template.delete({ where: { id } });
    return { id, deleted: true };
  }
}
