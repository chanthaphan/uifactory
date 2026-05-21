import { Body, Controller, Delete, Get, Param, Post, Put, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppsService } from './apps.service';
import { ChatDto, CreateAppDto, RunQueryDto, SharingDto, UpdateAppDto } from './dto/app.dto';
import { GenerateUiDto } from '../ai/dto/generate.dto';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';

@Controller('apps')
export class AppsController {
  constructor(private readonly service: AppsService) {}

  @Get()
  findMine(@CurrentUser() user: AuthUser) {
    return this.service.findMine(user);
  }

  @Get('catalog')
  catalog(@CurrentUser() user: AuthUser) {
    return this.service.catalog(user);
  }

  @Public()
  @Get('by-slug/:slug')
  bySlug(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.service.bySlug(slug, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateAppDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAppDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }

  @Post(':id/deploy')
  deploy(@Param('id') id: string, @Body() body: { note?: string }, @CurrentUser() user: AuthUser) {
    return this.service.setDeployed(id, true, user, body?.note);
  }

  @Post(':id/undeploy')
  undeploy(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.setDeployed(id, false, user);
  }

  @Get(':id/versions')
  versions(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.listVersions(id, user);
  }

  @Post(':id/rollback')
  rollback(@Param('id') id: string, @Body() body: { version: number }, @CurrentUser() user: AuthUser) {
    return this.service.rollback(id, Number(body?.version), user);
  }

  @Put(':id/sharing')
  setSharing(@Param('id') id: string, @Body() dto: SharingDto, @CurrentUser() user: AuthUser) {
    return this.service.setSharing(id, dto, user);
  }

  @Public()
  @Get(':id/pages/:pageId/data')
  pageData(@Param('id') id: string, @Param('pageId') pageId: string, @CurrentUser() user?: AuthUser) {
    return this.service.pageData(id, pageId, user);
  }

  @Public()
  @Post(':id/run-query')
  runQuery(@Param('id') id: string, @Body() dto: RunQueryDto, @CurrentUser() user?: AuthUser) {
    return this.service.runQueryAction(id, dto, user);
  }

  @Post(':id/generate-ui')
  generateUi(@Param('id') id: string, @Body() dto: GenerateUiDto, @CurrentUser() user: AuthUser) {
    return this.service.generateUi(id, dto, user);
  }

  @Public()
  @Post(':id/chat')
  chat(@Param('id') id: string, @Body() dto: ChatDto, @CurrentUser() user?: AuthUser) {
    return this.service.chat(id, dto.pageId, dto.messages, user, dto.conversationId);
  }

  /** Streaming chat: writes newline-delimited JSON ({ delta } chunks, then { done, source }). */
  @Public()
  @Post(':id/chat/stream')
  async chatStream(@Param('id') id: string, @Body() dto: ChatDto, @Res() res: Response, @CurrentUser() user?: AuthUser) {
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    try {
      const source = await this.service.chatStream(
        id,
        dto.pageId,
        dto.messages,
        (delta) => res.write(JSON.stringify({ delta }) + '\n'),
        user,
        dto.conversationId,
      );
      res.write(JSON.stringify({ done: true, source }) + '\n');
    } catch (err) {
      res.write(JSON.stringify({ error: (err as Error).message || 'Chat failed' }) + '\n');
    } finally {
      res.end();
    }
  }
}
