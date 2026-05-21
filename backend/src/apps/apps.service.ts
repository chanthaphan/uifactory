import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueriesService } from '../queries/queries.service';
import { AgentService, ChatMessage } from './agent.service';
import { AiService, GenerateUiResult } from '../ai/ai.service';
import { GenerateUiDto } from '../ai/dto/generate.dto';
import { ConversationsService } from '../conversations/conversations.service';
import { LIMITS, countWords } from '../common/limits';
import { RateLimiter } from '../common/rate-limiter';
import { AuthUser } from '../auth/auth.types';
import { CreateAppDto, SharingDto, UpdateAppDto } from './dto/app.dto';
import {
  AppAiConfig,
  AppDefinition,
  collectQueryIds,
  emptyDefinition,
  mergeAiConfig,
  normalizeDefinition,
  parseAiConfig,
  parseTemplate,
  redactAiConfig,
  remapQueryIds,
  slugify,
} from './app-defs';
import { decryptString, encryptString } from '../common/crypto.util';

type AppWith = Prisma.AppGetPayload<{ include: { owner: true; memberships: true } }>;

@Injectable()
export class AppsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queries: QueriesService,
    private readonly agent: AgentService,
    private readonly ai: AiService,
    private readonly conversations: ConversationsService,
  ) {}

  private include = { owner: true, memberships: true } as const;
  private readonly genLimiter = new RateLimiter(LIMITS.aiGenerateRatePerMin, 60_000);
  private readonly chatLimiter = new RateLimiter(LIMITS.chatRatePerMin, 60_000);

  private assertRate(limiter: RateLimiter, key: string, what: string) {
    if (!limiter.check(key)) {
      throw new HttpException(`Rate limit exceeded for ${what}. Please slow down and try again shortly.`, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

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

  /** Decrypt + parse an app's stored AI config. */
  private aiConfigOf(app: AppWith): AppAiConfig {
    return parseAiConfig(app.aiConfig ? decryptString(app.aiConfig) : null);
  }

  /** The definition to run: published snapshot for runners, draft for editors. */
  private runtimeDefinition(app: AppWith, user?: AuthUser): AppDefinition {
    const raw = !this.canEdit(app, user) && app.publishedDefinition ? app.publishedDefinition : app.definition;
    return normalizeDefinition(JSON.parse(raw));
  }

  // ---- serialization ----

  private serialize(app: AppWith, user?: AuthUser, usePublished = false) {
    const editable = this.canEdit(app, user);
    const raw = usePublished && app.publishedDefinition ? app.publishedDefinition : app.definition;
    const publishedHash = app.publishedDefinition || '';
    return {
      id: app.id,
      name: app.name,
      description: app.description,
      slug: app.slug,
      visibility: app.visibility,
      status: app.status,
      version: app.version,
      hasUnpublishedChanges: app.status === 'deployed' && app.definition !== publishedHash,
      definition: normalizeDefinition(JSON.parse(raw)),
      // Only expose the (redacted) AI config to editors.
      aiConfig: editable ? redactAiConfig(this.aiConfigOf(app)) : undefined,
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
    return this.serialize(app, user, true);
  }

  // ---- mutations ----

  async create(dto: CreateAppDto, user: AuthUser) {
    const bundle = dto.templateId
      ? parseTemplate((await this.getTemplateOrThrow(dto.templateId)).definition)
      : { definition: emptyDefinition(), dataSources: [], queries: [] };

    // Create the app first (data sources + queries need its id).
    const app = await this.prisma.app.create({
      data: {
        name: dto.name,
        description: dto.description,
        slug: slugify(dto.name),
        definition: JSON.stringify(bundle.definition),
        ownerId: user.id,
        memberships: { create: [{ userEmail: user.email, role: 'owner' }] },
      },
    });

    // Clone the template's data sources + queries under the new app, remap query refs.
    if (bundle.dataSources.length || bundle.queries.length) {
      const dsRefMap: Record<string, string> = {};
      for (const ds of bundle.dataSources) {
        const created = await this.prisma.dataSource.create({
          data: { name: ds.name, type: ds.type, config: encryptString(JSON.stringify(ds.config)), appId: app.id },
        });
        dsRefMap[ds.ref] = created.id;
      }
      const qRefMap: Record<string, string> = {};
      for (const q of bundle.queries) {
        const dataSourceId = dsRefMap[q.dataSourceRef];
        if (!dataSourceId) continue;
        const created = await this.prisma.query.create({
          data: { name: q.name, dataSourceId, appId: app.id, config: JSON.stringify(q.config) },
        });
        qRefMap[q.ref] = created.id;
      }
      const finalDef = remapQueryIds(bundle.definition, qRefMap);
      await this.prisma.app.update({ where: { id: app.id }, data: { definition: JSON.stringify(finalDef) } });
    }

    const full = await this.getOrThrow(app.id);
    return this.serialize(full, user);
  }

  private async getTemplateOrThrow(id: string) {
    const tpl = await this.prisma.template.findUnique({ where: { id } });
    if (!tpl) throw new NotFoundException('Template not found');
    return tpl;
  }

  async update(id: string, dto: UpdateAppDto, user: AuthUser) {
    const app = await this.getOrThrow(id);
    if (!this.canEdit(app, user)) throw new ForbiddenException('You cannot edit this app');

    const data: Prisma.AppUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.definition !== undefined) {
      const normalized = normalizeDefinition(dto.definition);
      if (normalized.pages.length > LIMITS.maxPagesPerApp) {
        throw new BadRequestException(`Too many pages: ${normalized.pages.length} (max ${LIMITS.maxPagesPerApp}).`);
      }
      data.definition = JSON.stringify(normalized);
    }
    if (dto.aiConfig !== undefined) {
      const merged = mergeAiConfig(this.aiConfigOf(app), dto.aiConfig as never);
      data.aiConfig = encryptString(JSON.stringify(merged));
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

  /** Deploy = publish the current draft as a versioned snapshot served to runners. */
  async setDeployed(id: string, deployed: boolean, user: AuthUser, note?: string) {
    const app = await this.getOrThrow(id);
    if (!this.canEdit(app, user)) throw new ForbiddenException('You cannot deploy this app');
    if (!deployed) {
      const updated = await this.prisma.app.update({ where: { id }, data: { status: 'draft' }, include: this.include });
      return this.serialize(updated, user);
    }
    // Cap how many apps a single owner can have deployed at once (viewing remains unlimited).
    if (app.status !== 'deployed') {
      const deployedCount = await this.prisma.app.count({ where: { ownerId: app.ownerId, status: 'deployed' } });
      if (deployedCount >= LIMITS.maxDeployedAppsPerUser) {
        throw new ForbiddenException(`Deploy limit reached: ${LIMITS.maxDeployedAppsPerUser} deployed apps per user. Undeploy another app first.`);
      }
    }
    const nextVersion = app.version + 1;
    const [, updated] = await this.prisma.$transaction([
      this.prisma.appVersion.create({
        data: { appId: id, version: nextVersion, definition: app.definition, note: note?.trim() || null, createdById: user.id },
      }),
      this.prisma.app.update({
        where: { id },
        data: { status: 'deployed', deployedAt: new Date(), publishedDefinition: app.definition, version: nextVersion },
        include: this.include,
      }),
    ]);
    return this.serialize(updated, user);
  }

  /** Version history for the editor's rollback UI (editors only). */
  async listVersions(id: string, user: AuthUser) {
    const app = await this.getOrThrow(id);
    if (!this.canEdit(app, user)) throw new ForbiddenException('You cannot view versions for this app');
    const rows = await this.prisma.appVersion.findMany({ where: { appId: id }, orderBy: { version: 'desc' } });
    const creatorIds = [...new Set(rows.map((r) => r.createdById).filter((x): x is string => !!x))];
    const creators = creatorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true, email: true } })
      : [];
    const nameById = new Map(creators.map((c) => [c.id, c.name || c.email]));
    return rows.map((r) => ({
      id: r.id,
      version: r.version,
      note: r.note,
      createdBy: r.createdById ? nameById.get(r.createdById) ?? null : null,
      createdAt: r.createdAt,
      pageCount: normalizeDefinition(JSON.parse(r.definition)).pages.length,
      isCurrent: r.version === app.version,
    }));
  }

  /** Restore a previous version into the editable draft (does not auto-publish). */
  async rollback(id: string, version: number, user: AuthUser) {
    const app = await this.getOrThrow(id);
    if (!this.canEdit(app, user)) throw new ForbiddenException('You cannot roll back this app');
    const snapshot = await this.prisma.appVersion.findUnique({ where: { appId_version: { appId: id, version } } });
    if (!snapshot) throw new NotFoundException(`Version ${version} not found`);
    const updated = await this.prisma.app.update({
      where: { id },
      data: { definition: snapshot.definition },
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

  private assertRunnable(app: AppWith, user?: AuthUser) {
    if (!this.canView(app, user)) throw new ForbiddenException('No access');
    if (app.status !== 'deployed' && !this.canEdit(app, user)) throw new ForbiddenException('Not deployed');
  }

  /** All query ids referenced by the active definition — the only ones an app may run. */
  private allowedQueryIds(def: AppDefinition): Set<string> {
    return new Set(collectQueryIds(def));
  }

  /** Query ids a single page may run: its bound query, its chat query, and its named actions. */
  private pageQueryIds(page: AppDefinition['pages'][number]): Set<string> {
    const ids = [page.queryId, page.chat?.queryId, ...(page.actions ?? []).map((a) => a.queryId)];
    return new Set(ids.filter((x): x is string => !!x));
  }

  async pageData(id: string, pageId: string, user?: AuthUser) {
    const app = await this.getOrThrow(id);
    this.assertRunnable(app, user);
    const def = this.runtimeDefinition(app, user);
    const page = def.pages.find((p) => p.id === pageId);
    if (!page) throw new NotFoundException('Page not found');
    const queryId = page.queryId || page.chat?.queryId;
    if (!queryId) return { data: null };
    const result = await this.queries.run(queryId, undefined, user?.id);
    return { data: result.data, meta: result.meta };
  }

  /** Run a query/action referenced by the app, with parameters — powers interactive UI + write-back. */
  async runQueryAction(
    id: string,
    body: { queryId?: string; action?: string; pageId?: string; params?: Record<string, unknown> },
    user?: AuthUser,
  ) {
    const app = await this.getOrThrow(id);
    this.assertRunnable(app, user);
    const def = this.runtimeDefinition(app, user);

    const page = body.pageId ? def.pages.find((p) => p.id === body.pageId) : undefined;
    let queryId = body.queryId;
    if (!queryId && body.action) {
      const pages = page ? [page] : def.pages;
      for (const p of pages) {
        const found = (p.actions ?? []).find((a) => a.name === body.action);
        if (found) {
          queryId = found.queryId;
          break;
        }
      }
    }
    if (!queryId) throw new NotFoundException('Unknown query or action');
    // Scope to the calling page when known (page isolation); otherwise fall back to the whole app.
    const allowed = page ? this.pageQueryIds(page) : this.allowedQueryIds(def);
    if (!allowed.has(queryId)) {
      throw new ForbiddenException(page ? 'This query is not available on this page' : 'This query is not part of the app');
    }
    // Per-app guard: non-editors may run write (mutation) actions only when allowed.
    if (def.allowWriteActions === false && !this.canEdit(app, user) && (await this.isMutationQuery(queryId))) {
      throw new ForbiddenException('You are not allowed to run write actions on this app');
    }
    const result = await this.queries.run(queryId, body.params, user?.id);
    return { data: result.data, meta: result.meta };
  }

  /** A query is a "write" if its SQL is not a SELECT/WITH/PRAGMA, or its REST method is not GET. */
  private async isMutationQuery(queryId: string): Promise<boolean> {
    const q = await this.prisma.query.findUnique({ where: { id: queryId } });
    if (!q) return false;
    const cfg = JSON.parse(q.config) as { sql?: string; method?: string };
    if (typeof cfg.sql === 'string') return !/^\s*(select|with|pragma)/i.test(cfg.sql);
    return (cfg.method || 'GET').toUpperCase() !== 'GET';
  }

  /** Compose the chat system prompt + grounding data for a page (shared by chat + chatStream). */
  private async chatContext(app: AppWith, pageId: string | undefined, user?: AuthUser) {
    const def = this.runtimeDefinition(app, user);
    const page = pageId ? def.pages.find((p) => p.id === pageId) : def.pages.find((p) => p.type === 'chat');
    let system = page?.chat?.systemPrompt || `You are an assistant for the "${app.name}" app.`;
    if (def.buildGuidelines?.trim()) {
      system += `\n\nProject guidelines to follow:\n${def.buildGuidelines.trim().slice(0, 8000)}`;
    }
    let contextData: unknown;
    const queryId = page?.chat?.queryId;
    if (queryId) {
      try {
        contextData = (await this.queries.run(queryId, undefined, user?.id)).data;
      } catch {
        contextData = undefined;
      }
    }
    return { system, contextData };
  }

  private lastUserMessage(messages: ChatMessage[]): string {
    return [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  }

  private assertChatInputWithinLimit(messages: ChatMessage[]) {
    const words = countWords(this.lastUserMessage(messages));
    if (words > LIMITS.maxChatInputWords) {
      throw new BadRequestException(`Message too long: ${words} words (max ${LIMITS.maxChatInputWords}).`);
    }
  }

  async chat(id: string, pageId: string | undefined, messages: ChatMessage[], user?: AuthUser, conversationId?: string, persist?: boolean) {
    const app = await this.getOrThrow(id);
    this.assertRunnable(app, user);
    this.assertRate(this.chatLimiter, user?.id ?? 'anon', 'chat');
    this.assertChatInputWithinLimit(messages);
    const { system, contextData } = await this.chatContext(app, pageId, user);
    const doPersist = Boolean(persist && user);
    let convId = conversationId;
    if (doPersist) convId = await this.conversations.ensure(app.id, pageId, user!.id, conversationId, this.lastUserMessage(messages));
    const result = await this.agent.chat(this.aiConfigOf(app), system, messages, contextData, convId ?? conversationId);
    if (doPersist && convId) await this.conversations.appendTurn(convId, this.lastUserMessage(messages), result.reply);
    return { ...result, conversationId: doPersist ? convId : undefined };
  }

  /** Streaming chat: invokes onDelta with each text chunk. Returns the responder source + thread id. */
  async chatStream(
    id: string,
    pageId: string | undefined,
    messages: ChatMessage[],
    onDelta: (t: string) => void,
    user?: AuthUser,
    conversationId?: string,
    persist?: boolean,
  ) {
    const app = await this.getOrThrow(id);
    this.assertRunnable(app, user);
    this.assertRate(this.chatLimiter, user?.id ?? 'anon', 'chat');
    this.assertChatInputWithinLimit(messages);
    const { system, contextData } = await this.chatContext(app, pageId, user);
    const doPersist = Boolean(persist && user);
    let convId = conversationId;
    if (doPersist) convId = await this.conversations.ensure(app.id, pageId, user!.id, conversationId, this.lastUserMessage(messages));
    let full = '';
    const source = await this.agent.chatStream(
      this.aiConfigOf(app),
      system,
      messages,
      (d) => { full += d; onDelta(d); },
      contextData,
      convId ?? conversationId,
    );
    if (doPersist && convId) await this.conversations.appendTurn(convId, this.lastUserMessage(messages), full);
    return { source, conversationId: doPersist ? convId : undefined };
  }

  /**
   * Generate a UI page for an app using its configured AI: an external coding agent (agent-api),
   * the app's own provider key, or the platform LLM — augmented with the app's build guidelines.
   */
  async generateUi(id: string, dto: GenerateUiDto, user: AuthUser): Promise<GenerateUiResult> {
    const app = await this.getOrThrow(id);
    if (!this.canEdit(app, user)) throw new ForbiddenException('You cannot edit this app');
    this.assertRate(this.genLimiter, user.id, 'UI generation');

    const def = normalizeDefinition(JSON.parse(app.definition));
    const guidelines = dto.guidelines ?? def.buildGuidelines;
    const effectiveDto: GenerateUiDto = { ...dto, guidelines };
    const cfg = this.aiConfigOf(app);

    // 1) External coding agent (can sync with its own skills + the guidelines we pass it).
    if (cfg.mode === 'agent-api' && cfg.agent?.url) {
      try {
        const text = await this.agent.generateUiViaAgent(cfg, {
          prompt: dto.prompt,
          sample: dto.sample,
          currentHtml: dto.currentHtml,
          dataGuidance: dto.dataGuidance,
          guidelines,
          queryName: dto.queryName,
        });
        const html = this.ai.finalizeHtml(text);
        if (html) return { html, source: 'agent-api' };
        return this.ai.fallbackResult(effectiveDto, 'The agent API did not return HTML; used the built-in template instead.');
      } catch (err) {
        return this.ai.fallbackResult(effectiveDto, `Agent API request failed (${(err as Error).message}); used the built-in template instead.`);
      }
    }

    // 2) App's own provider key, or 3) platform default LLM.
    try {
      const result = await this.agent.complete(cfg, this.ai.systemPrompt(guidelines), this.ai.buildUserContent(effectiveDto));
      if (result) {
        const html = this.ai.finalizeHtml(result.text);
        if (html) return { html, source: 'ai' };
        return this.ai.fallbackResult(effectiveDto, 'The model did not return HTML; used the built-in template instead.');
      }
    } catch (err) {
      return this.ai.fallbackResult(effectiveDto, `AI request failed (${(err as Error).message}); used the built-in template instead.`);
    }
    // No provider anywhere -> template.
    return this.ai.fallbackResult(effectiveDto);
  }
}
