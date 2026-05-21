import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppAccessService } from '../apps/app-access.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AppAccessService,
  ) {}

  private title(seed?: string): string {
    const t = (seed || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    return t || 'New chat';
  }

  /** List a user's threads for an app (optionally filtered to one chat page). */
  async list(appId: string, pageId: string | undefined, user: AuthUser) {
    await this.access.assertCanView(appId, user);
    const rows = await this.prisma.conversation.findMany({
      where: { appId, userId: user.id, ...(pageId ? { pageId } : {}) },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
    return rows.map((r) => ({ id: r.id, title: r.title, pageId: r.pageId, messageCount: r._count.messages, updatedAt: r.updatedAt }));
  }

  /** Fetch a thread with its messages (owner only). */
  async get(appId: string, conversationId: string, user: AuthUser) {
    await this.access.assertCanView(appId, user);
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!convo || convo.appId !== appId) throw new NotFoundException('Conversation not found');
    if (convo.userId !== user.id) throw new ForbiddenException('Not your conversation');
    return {
      id: convo.id,
      title: convo.title,
      pageId: convo.pageId,
      messages: convo.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    };
  }

  async remove(appId: string, conversationId: string, user: AuthUser) {
    const convo = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!convo || convo.appId !== appId) throw new NotFoundException('Conversation not found');
    if (convo.userId !== user.id) throw new ForbiddenException('Not your conversation');
    await this.prisma.conversation.delete({ where: { id: conversationId } });
    return { id: conversationId, deleted: true };
  }

  // ---- used by the chat flow (no extra access check; the app layer already gated the chat) ----

  /** Return the caller's conversation if the id is valid + owned, else create a fresh thread. */
  async ensure(appId: string, pageId: string | undefined, userId: string, providedId: string | undefined, titleSeed?: string): Promise<string> {
    if (providedId) {
      const existing = await this.prisma.conversation.findUnique({ where: { id: providedId } });
      if (existing && existing.appId === appId && existing.userId === userId) return existing.id;
    }
    const created = await this.prisma.conversation.create({
      data: { appId, pageId: pageId ?? null, userId, title: this.title(titleSeed) },
    });
    return created.id;
  }

  /** Append one user + assistant turn to a thread and bump its updatedAt. */
  async appendTurn(conversationId: string, userContent: string, assistantContent: string): Promise<void> {
    await this.prisma.message.createMany({
      data: [
        { conversationId, role: 'user', content: userContent.slice(0, 20000) },
        { conversationId, role: 'assistant', content: assistantContent.slice(0, 50000) },
      ],
    });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  }
}
