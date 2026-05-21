import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionService } from '../execution/execution.service';
import { AppAccessService } from '../apps/app-access.service';
import { CreateDataSourceDto, UpdateDataSourceDto } from './dto/datasource.dto';
import { DataSourceType } from '../execution/execution.types';
import { AuthUser } from '../auth/auth.types';
import { decryptString, encryptString } from '../common/crypto.util';
import { redactConfig } from '../common/redact.util';
import { LIMITS } from '../common/limits';
import { BadRequestException } from '@nestjs/common';

type DsRow = { id: string; name: string; type: string; config: string; authMode: string; appId: string; createdAt: Date; updatedAt: Date };

@Injectable()
export class DataSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly execution: ExecutionService,
    private readonly access: AppAccessService,
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
      authMode: ds.authMode,
      appId: ds.appId,
      createdAt: ds.createdAt,
      updatedAt: ds.updatedAt,
    };
  }

  /** Merge a per-user credential over the shared config (headers are deep-merged). */
  private mergeConfig(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
    const merged = { ...base, ...over };
    const baseHeaders = (base.headers as Record<string, string>) || undefined;
    const overHeaders = (over.headers as Record<string, string>) || undefined;
    if (baseHeaders || overHeaders) merged.headers = { ...(baseHeaders || {}), ...(overHeaders || {}) };
    return merged;
  }

  /**
   * Raw config for execution, resolving the *caller's* credential when the data source is per-user.
   * Throws a clear error when a per-user credential is required but missing.
   */
  async getRawForUser(id: string, userId?: string) {
    const row = await this.prisma.dataSource.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Data source ${id} not found`);
    let parsedConfig = this.parseConfig(row);
    if (row.authMode === 'per-user') {
      if (!userId) {
        throw new ForbiddenException('This data source uses per-user credentials. Sign in and connect your account to use it.');
      }
      const cred = await this.prisma.userCredential.findUnique({ where: { userId_dataSourceId: { userId, dataSourceId: id } } });
      if (!cred) {
        throw new ForbiddenException(`Connect your account for "${row.name}" to use this data.`);
      }
      parsedConfig = this.mergeConfig(parsedConfig, JSON.parse(decryptString(cred.config)) as Record<string, unknown>);
    }
    return { ...row, parsedConfig, type: row.type as DataSourceType };
  }

  async findAll(appId: string, user: AuthUser) {
    await this.access.assertCanView(appId, user);
    const rows = await this.prisma.dataSource.findMany({ where: { appId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.serialize(r));
  }

  async findOne(id: string, user: AuthUser) {
    const row = await this.prisma.dataSource.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Data source ${id} not found`);
    await this.access.assertCanView(row.appId, user);
    return this.serialize(row);
  }

  /** Internal: raw (decrypted) config for execution. App access is enforced upstream. */
  async getRaw(id: string) {
    const row = await this.prisma.dataSource.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Data source ${id} not found`);
    return { ...row, parsedConfig: this.parseConfig(row), type: row.type as DataSourceType };
  }

  private async assertDataSourceCapacity(appId: string) {
    const count = await this.prisma.dataSource.count({ where: { appId } });
    if (count >= LIMITS.maxDataSourcesPerApp) {
      throw new BadRequestException(`This app already has the maximum of ${LIMITS.maxDataSourcesPerApp} data sources.`);
    }
  }

  async create(appId: string, dto: CreateDataSourceDto, user: AuthUser) {
    await this.access.assertCanEdit(appId, user);
    await this.assertDataSourceCapacity(appId);
    const row = await this.prisma.dataSource.create({
      data: { name: dto.name, type: dto.type, config: encryptString(JSON.stringify(dto.config)), authMode: dto.authMode || 'shared', appId },
    });
    return this.serialize(row);
  }

  /** Clone an admin-curated prebuilt connector into a new per-app data source. */
  async createFromConnector(appId: string, connectorId: string, name: string | undefined, user: AuthUser) {
    await this.access.assertCanEdit(appId, user);
    await this.assertDataSourceCapacity(appId);
    const connector = await this.prisma.connector.findUnique({ where: { id: connectorId } });
    if (!connector) throw new NotFoundException(`Connector ${connectorId} not found`);
    const row = await this.prisma.dataSource.create({
      data: {
        name: name?.trim() || connector.name,
        type: connector.type,
        // Re-encrypt under the same key (the stored connector config is already encrypted plaintext).
        config: encryptString(decryptString(connector.config)),
        appId,
      },
    });
    return this.serialize(row);
  }

  async update(id: string, dto: UpdateDataSourceDto, user: AuthUser) {
    const row = await this.prisma.dataSource.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Data source ${id} not found`);
    await this.access.assertCanEdit(row.appId, user);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.config !== undefined) data.config = encryptString(JSON.stringify(dto.config));
    if (dto.authMode !== undefined) data.authMode = dto.authMode;
    const updated = await this.prisma.dataSource.update({ where: { id }, data });
    return this.serialize(updated);
  }

  async remove(id: string, user: AuthUser) {
    const row = await this.prisma.dataSource.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Data source ${id} not found`);
    await this.access.assertCanEdit(row.appId, user);
    await this.prisma.dataSource.delete({ where: { id } });
    return { id, deleted: true };
  }

  async test(id: string, user: AuthUser) {
    const row = await this.prisma.dataSource.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Data source ${id} not found`);
    await this.access.assertCanView(row.appId, user);
    return this.execution.test(row.type as DataSourceType, this.parseConfig(row));
  }

  async testInline(appId: string, type: DataSourceType, config: Record<string, unknown>, user: AuthUser) {
    await this.access.assertCanEdit(appId, user);
    return this.execution.test(type, config);
  }
}
