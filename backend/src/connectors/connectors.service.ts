import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decryptString, encryptString } from '../common/crypto.util';
import { redactConfig } from '../common/redact.util';
import { DataSourceType } from '../execution/execution.types';
import { CreateConnectorDto, UpdateConnectorDto } from './dto/connector.dto';
import { AuthUser } from '../auth/auth.types';

type ConnectorRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  type: string;
  config: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ConnectorsService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(c: ConnectorRow) {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      category: c.category,
      type: c.type as DataSourceType,
      config: redactConfig(JSON.parse(decryptString(c.config)) as Record<string, unknown>),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  /** Any signed-in member can browse the connector catalog (configs are redacted). */
  async findAll() {
    const rows = await this.prisma.connector.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    return rows.map((r) => this.serialize(r));
  }

  async create(dto: CreateConnectorDto, user: AuthUser) {
    const row = await this.prisma.connector.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        type: dto.type,
        config: encryptString(JSON.stringify(dto.config)),
        createdById: user.id,
      },
    });
    return this.serialize(row);
  }

  async update(id: string, dto: UpdateConnectorDto) {
    const row = await this.prisma.connector.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Connector ${id} not found`);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.config !== undefined) data.config = encryptString(JSON.stringify(dto.config));
    const updated = await this.prisma.connector.update({ where: { id }, data });
    return this.serialize(updated);
  }

  async remove(id: string) {
    const row = await this.prisma.connector.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Connector ${id} not found`);
    await this.prisma.connector.delete({ where: { id } });
    return { id, deleted: true };
  }
}
