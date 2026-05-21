import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

type AppWith = Prisma.AppGetPayload<{ include: { owner: true; memberships: true } }>;

/**
 * Shared app access checks, used by the app, datasources and queries modules.
 * Depends only on Prisma to avoid a module dependency cycle.
 */
@Injectable()
export class AppAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private membershipRole(app: AppWith, email?: string): string | null {
    if (!email) return null;
    return app.memberships.find((m) => m.userEmail.toLowerCase() === email.toLowerCase())?.role ?? null;
  }

  canView(app: AppWith, user?: AuthUser): boolean {
    if (user) {
      if (app.ownerId === user.id || user.role === 'admin') return true;
      if (this.membershipRole(app, user.email)) return true;
      return app.visibility === 'org' || app.visibility === 'public';
    }
    return app.visibility === 'public';
  }

  canEdit(app: AppWith, user?: AuthUser): boolean {
    if (!user) return false;
    if (app.ownerId === user.id || user.role === 'admin') return true;
    const role = this.membershipRole(app, user.email);
    return role === 'owner' || role === 'editor';
  }

  private async load(appId: string): Promise<AppWith> {
    const app = await this.prisma.app.findUnique({ where: { id: appId }, include: { owner: true, memberships: true } });
    if (!app) throw new NotFoundException(`App ${appId} not found`);
    return app;
  }

  async assertCanEdit(appId: string, user?: AuthUser): Promise<AppWith> {
    const app = await this.load(appId);
    if (!this.canEdit(app, user)) throw new ForbiddenException('You cannot manage this app');
    return app;
  }

  async assertCanView(appId: string, user?: AuthUser): Promise<AppWith> {
    const app = await this.load(appId);
    if (!this.canView(app, user)) throw new ForbiddenException('You do not have access to this app');
    return app;
  }
}
