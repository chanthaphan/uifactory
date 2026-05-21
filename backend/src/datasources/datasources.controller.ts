import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { DataSourcesService } from './datasources.service';
import { CreateDataSourceDto, UpdateDataSourceDto } from './dto/datasource.dto';
import { CurrentUser } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';

@Controller('apps/:appId/datasources')
export class DataSourcesController {
  constructor(private readonly service: DataSourcesService) {}

  @Get()
  findAll(@Param('appId') appId: string, @CurrentUser() user: AuthUser) {
    return this.service.findAll(appId, user);
  }

  @Post('test')
  testInline(@Param('appId') appId: string, @Body() body: CreateDataSourceDto, @CurrentUser() user: AuthUser) {
    return this.service.testInline(appId, body.type, body.config, user);
  }

  @Post()
  create(@Param('appId') appId: string, @Body() dto: CreateDataSourceDto, @CurrentUser() user: AuthUser) {
    return this.service.create(appId, dto, user);
  }

  @Post('from-connector/:connectorId')
  createFromConnector(
    @Param('appId') appId: string,
    @Param('connectorId') connectorId: string,
    @Body() body: { name?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createFromConnector(appId, connectorId, body?.name, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDataSourceDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }

  @Post(':id/test')
  test(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.test(id, user);
  }
}
