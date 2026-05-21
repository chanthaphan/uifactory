import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { AppsService } from './apps.service';
import { ChatDto, CreateAppDto, SharingDto, UpdateAppDto } from './dto/app.dto';
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
  deploy(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.setDeployed(id, true, user);
  }

  @Post(':id/undeploy')
  undeploy(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.setDeployed(id, false, user);
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
  @Post(':id/chat')
  chat(@Param('id') id: string, @Body() dto: ChatDto, @CurrentUser() user?: AuthUser) {
    return this.service.chat(id, dto.pageId, dto.messages, user);
  }
}
