import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CurrentUser } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';

@Controller('apps/:appId/conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  list(@Param('appId') appId: string, @Query('pageId') pageId: string | undefined, @CurrentUser() user: AuthUser) {
    return this.service.list(appId, pageId, user);
  }

  @Get(':conversationId')
  get(@Param('appId') appId: string, @Param('conversationId') conversationId: string, @CurrentUser() user: AuthUser) {
    return this.service.get(appId, conversationId, user);
  }

  @Delete(':conversationId')
  remove(@Param('appId') appId: string, @Param('conversationId') conversationId: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(appId, conversationId, user);
  }
}
