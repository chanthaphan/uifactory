import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { DataSourcesService } from './datasources.service';
import { CreateDataSourceDto, UpdateDataSourceDto } from './dto/datasource.dto';

@Controller('datasources')
export class DataSourcesController {
  constructor(private readonly service: DataSourcesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post('test')
  testInline(@Body() body: CreateDataSourceDto) {
    return this.service.testInline(body.type, body.config);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateDataSourceDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDataSourceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/test')
  test(@Param('id') id: string) {
    return this.service.test(id);
  }
}
