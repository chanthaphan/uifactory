import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { DataSourcesService } from './datasources.service';
import { CreateDataSourceDto, UpdateDataSourceDto } from './dto/datasource.dto';
import { CurrentUser } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';

@Controller('datasources')
export class DataSourcesController {
  constructor(private readonly service: DataSourcesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user);
  }

  @Post('test')
  testInline(@Body() body: CreateDataSourceDto) {
    return this.service.testInline(body.type, body.config);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateDataSourceDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
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
