import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { QueriesService } from './queries.service';
import { CreateQueryDto, RunInlineDto, UpdateQueryDto } from './dto/query.dto';
import { CurrentUser } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';

@Controller('queries')
export class QueriesController {
  constructor(private readonly service: QueriesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('dataSourceId') dataSourceId?: string) {
    return this.service.findAll(user, dataSourceId);
  }

  @Post('run')
  runInline(@Body() body: RunInlineDto, @CurrentUser() user: AuthUser) {
    return this.service.runInline(body.dataSourceId, body.config, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
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
