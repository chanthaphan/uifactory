import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppAccessService } from '../apps/app-access.service';
import { encryptString } from '../common/crypto.util';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AppAccessService,
  ) {}

  /** Per-user data sources in the app + whether the current user has supplied their credential. */
  async listForApp(appId: string, user: AuthUser) {
    await this.access.assertCanView(appId, user);
    const sources = await this.prisma.dataSource.findMany({
      where: { appId, authMode: 'per-user' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, type: true },
    });
    if (!sources.length) return [];
    const creds = await this.prisma.userCredential.findMany({
      where: { userId: user.id, dataSourceId: { in: sources.map((s) => s.id) } },
      select: { dataSourceId: true },
    });
    const have = new Set(creds.map((c) => c.dataSourceId));
    return sources.map((s) => ({ dataSourceId: s.id, name: s.name, type: s.type, hasCredential: have.has(s.id) }));
  }

  private async assertPerUserSourceInApp(appId: string, dataSourceId: string) {
    const ds = await this.prisma.dataSource.findUnique({ where: { id: dataSourceId } });
    if (!ds || ds.appId !== appId) throw new NotFoundException('Data source not found in this app');
    if (ds.authMode !== 'per-user') throw new BadRequestException('This data source does not use per-user credentials');
    return ds;
  }

  /** Set or replace the current user's credential for a per-user data source. */
  async set(appId: string, dataSourceId: string, config: Record<string, unknown>, user: AuthUser) {
    await this.access.assertCanView(appId, user);
    if (!config || typeof config !== 'object') throw new BadRequestException('A credential config object is required');
    await this.assertPerUserSourceInApp(appId, dataSourceId);
    const encrypted = encryptString(JSON.stringify(config));
    await this.prisma.userCredential.upsert({
      where: { userId_dataSourceId: { userId: user.id, dataSourceId } },
      create: { userId: user.id, dataSourceId, config: encrypted },
      update: { config: encrypted },
    });
    return { dataSourceId, hasCredential: true };
  }

  async remove(appId: string, dataSourceId: string, user: AuthUser) {
    await this.access.assertCanView(appId, user);
    await this.prisma.userCredential.deleteMany({ where: { userId: user.id, dataSourceId } });
    return { dataSourceId, hasCredential: false };
  }
}
