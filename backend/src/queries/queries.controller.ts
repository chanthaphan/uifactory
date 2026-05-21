import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { QueriesService } from './queries.service';
import { CreateQueryDto, RunInlineDto, UpdateQueryDto } from './dto/query.dto';
import { CurrentUser } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';

@Controller('apps/:appId/queries')
export class QueriesController {
  constructor(private readonly service: QueriesService) {}

  @Get()
  findAll(@Param('appId') appId: string, @CurrentUser() user: AuthUser) {
    return this.service.findAll(appId, user);
  }

  @Post('run')
  runInline(@Param('appId') appId: string, @Body() body: RunInlineDto, @CurrentUser() user: AuthUser) {
    return this.service.runInline(appId, body.dataSourceId, body.config, user);
  }

  @Post()
  create(@Param('appId') appId: string, @Body() dto: CreateQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.create(appId, dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }

  @Post(':id/run')
  run(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.runChecked(id, user);
  }
}
