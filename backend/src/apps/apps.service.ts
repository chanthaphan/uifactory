import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueriesService } from '../queries/queries.service';
import { AgentService, ChatMessage } from './agent.service';
import { AuthUser } from '../auth/auth.types';
import { CreateAppDto, SharingDto, UpdateAppDto } from './dto/app.dto';
import {
  AppDefinition,
  emptyDefinition,
  mergeAiConfig,
  normalizeDefinition,
  parseAiConfig,
  redactAiConfig,
  slugify,
} from './app-defs';

type AppWith = Prisma.AppGetPayload<{ include: { owner: true; memberships: true } }>;

@Injectable()
export class AppsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queries: QueriesService,
    private readonly agent: AgentService,
  ) {}

  private include = { owner: true, memberships: true } as const;

  // ---- access control ----

  private membershipRole(app: AppWith, email?: string): string | null {
    if (!email) return null;
    return app.memberships.find((m) => m.userEmail.toLowerCase() === email.toLowerCase())?.role ?? null;
  }

  private canView(app: AppWith, user?: AuthUser): boolean {
    if (user) {
      if (app.ownerId === user.id || user.role === 'admin') return true;
      if (this.membershipRole(app, user.email)) return true;
      if (app.visibility === 'org' || app.visibility === 'public') return true;
      return false;
    }
    return app.visibility === 'public';
  }

  private canEdit(app: AppWith, user?: AuthUser): boolean {
    if (!user) return false;
    if (app.ownerId === user.id || user.role === 'admin') return true;
    const role = this.membershipRole(app, user.email);
    return role === 'owner' || role === 'editor';
  }

  // ---- serialization ----

  private serialize(app: AppWith, user?: AuthUser) {
    const editable = this.canEdit(app, user);
    return {
      id: app.id,
      name: app.name,
      description: app.description,
      slug: app.slug,
      visibility: app.visibility,
      status: app.status,
      definition: normalizeDefinition(JSON.parse(app.definition)),
      // Only expose the (redacted) AI config to editors.
      aiConfig: editable ? redactAiConfig(parseAiConfig(app.aiConfig)) : undefined,
      owner: { id: app.owner.id, name: app.owner.name, email: app.owner.email },
      members: editable ? app.memberships.map((m) => ({ email: m.userEmail, role: m.role })) : undefined,
      myRole: app.ownerId === user?.id ? 'owner' : this.membershipRole(app, user?.email) ?? (editable ? 'editor' : 'viewer'),
      canEdit: editable,
      deployedAt: app.deployedAt,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  }

  private summary(app: AppWith, user?: AuthUser) {
    return {
      id: app.id,
      name: app.name,
      description: app.description,
      slug: app.slug,
      visibility: app.visibility,
      status: app.status,
      pageCount: normalizeDefinition(JSON.parse(app.definition)).pages.length,
      owner: { id: app.owner.id, name: app.owner.name, email: app.owner.email },
      canEdit: this.canEdit(app, user),
      updatedAt: app.updatedAt,
    };
  }

  private async getOrThrow(id: string): Promise<AppWith> {
    const app = await this.prisma.app.findUnique({ where: { id }, include: this.include });
    if (!app) throw new NotFoundException(`App ${id} not found`);
    return app;
  }

  // ---- queries ----

  /** Apps the user owns or can edit (the build workspace). */
  async findMine(user: AuthUser) {
    const apps = await this.prisma.app.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { memberships: { some: { userEmail: user.email, role: { in: ['owner', 'editor'] } } } },
        ],
      },
      include: this.include,
      orderBy: { updatedAt: 'desc' },
    });
    return apps.map((a) => this.summary(a, user));
  }

  /** Deployed apps the user is allowed to run (the catalog). */
  async catalog(user: AuthUser) {
    const apps = await this.prisma.app.findMany({
      where: {
        status: 'deployed',
        OR: [
          { visibility: 'public' },
          { visibility: 'org' },
          { ownerId: user.id },
          { memberships: { some: { userEmail: user.email } } },
        ],
      },
      include: this.include,
      orderBy: { deployedAt: 'desc' },
    });
    return apps.map((a) => this.summary(a, user));
  }

  async findOne(id: string, user: AuthUser) {
    const app = await this.getOrThrow(id);
    if (!this.canView(app, user)) throw new ForbiddenException('You do not have access to this app');
    return this.serialize(app, user);
  }

  async bySlug(slug: string, user?: AuthUser) {
    const app = await this.prisma.app.findUnique({ where: { slug }, include: this.include });
    if (!app) throw new NotFoundException('App not found');
    if (!this.canView(app, user)) throw new ForbiddenException('You do not have access to this app');
    if (app.status !== 'deployed' && !this.canEdit(app, user)) {
      throw new ForbiddenException('This app is not deployed');
    }
    return this.serialize(app, user);
  }

  // ---- mutations ----

  async create(dto: CreateAppDto, user: AuthUser) {
    let definition: AppDefinition = emptyDefinition();
    if (dto.templateId) {
      const tpl = await this.prisma.template.findUnique({ where: { id: dto.templateId } });
      if (!tpl) throw new NotFoundException('Template not found');
      definition = normalizeDefinition(JSON.parse(tpl.definition));
    }
    const app = await this.prisma.app.create({
      data: {
        name: dto.name,
        description: dto.description,
        slug: slugify(dto.name),
        definition: JSON.stringify(definition),
        ownerId: user.id,
        memberships: { create: [{ userEmail: user.email, role: 'owner' }] },
      },
      include: this.include,
    });
    return this.serialize(app, user);
  }

  async update(id: string, dto: UpdateAppDto, user: AuthUser) {
    const app = await this.getOrThrow(id);
    if (!this.canEdit(app, user)) throw new ForbiddenException('You cannot edit this app');

    const data: Prisma.AppUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.definition !== undefined) data.definition = JSON.stringify(normalizeDefinition(dto.definition));
    if (dto.aiConfig !== undefined) {
      const merged = mergeAiConfig(parseAiConfig(app.aiConfig), dto.aiConfig as never);
      data.aiConfig = JSON.stringify(merged);
    }
    const updated = await this.prisma.app.update({ where: { id }, data, include: this.include });
    return this.serialize(updated, user);
  }

  async remove(id: string, user: AuthUser) {
    const app = await this.getOrThrow(id);
    if (app.ownerId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Only the owner or an admin can delete this app');
    }
    await this.prisma.app.delete({ where: { id } });
    return { id, deleted: true };
  }

  async setDeployed(id: string, deployed: boolean, user: AuthUser) {
    const app = await this.getOrThrow(id);
    if (!this.canEdit(app, user)) throw new ForbiddenException('You cannot deploy this app');
    const updated = await this.prisma.app.update({
      where: { id },
      data: { status: deployed ? 'deployed' : 'draft', deployedAt: deployed ? new Date() : null },
      include: this.include,
    });
    return this.serialize(updated, user);
  }

  async setSharing(id: string, dto: SharingDto, user: AuthUser) {
    const app = await this.getOrThrow(id);
    if (!this.canEdit(app, user)) throw new ForbiddenException('You cannot change sharing for this app');

    const ownerEmail = app.owner.email.toLowerCase();
    const members = (dto.members ?? []).filter((m) => m.email.toLowerCase() !== ownerEmail);

    await this.prisma.$transaction([
      this.prisma.appMembership.deleteMany({ where: { appId: id, role: { not: 'owner' } } }),
      ...members.map((m) =>
        this.prisma.appMembership.create({ data: { appId: id, userEmail: m.email.toLowerCase(), role: m.role } }),
      ),
      this.prisma.app.update({ where: { id }, data: { visibility: dto.visibility } }),
    ]);

    const updated = await this.getOrThrow(id);
    return this.serialize(updated, user);
  }

  // ---- runtime ----

  async pageData(id: string, pageId: string, user?: AuthUser) {
    const app = await this.getOrThrow(id);
    if (!this.canView(app, user)) throw new ForbiddenException('No access');
    if (app.status !== 'deployed' && !this.canEdit(app, user)) throw new ForbiddenException('Not deployed');
    const def = normalizeDefinition(JSON.parse(app.definition));
    const page = def.pages.find((p) => p.id === pageId);
    if (!page) throw new NotFoundException('Page not found');
    const queryId = page.queryId || page.chat?.queryId;
    if (!queryId) return { data: null };
    const result = await this.queries.run(queryId);
    return { data: result.data, meta: result.meta };
  }

  async chat(id: string, pageId: string | undefined, messages: ChatMessage[], user?: AuthUser) {
    const app = await this.getOrThrow(id);
    if (!this.canView(app, user)) throw new ForbiddenException('No access');
    if (app.status !== 'deployed' && !this.canEdit(app, user)) throw new ForbiddenException('Not deployed');

    const def = normalizeDefinition(JSON.parse(app.definition));
    const page = pageId ? def.pages.find((p) => p.id === pageId) : def.pages.find((p) => p.type === 'chat');
    const system = page?.chat?.systemPrompt || `You are an assistant for the "${app.name}" app.`;

    let contextData: unknown;
    const queryId = page?.chat?.queryId;
    if (queryId) {
      try {
        contextData = (await this.queries.run(queryId)).data;
      } catch {
        contextData = undefined;
      }
    }

    return this.agent.chat(parseAiConfig(app.aiConfig), system, messages, contextData);
  }
}
