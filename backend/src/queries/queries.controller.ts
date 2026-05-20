import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { QueriesService } from './queries.service';
import { CreateQueryDto, RunInlineDto, UpdateQueryDto } from './dto/query.dto';

@Controller('queries')
export class QueriesController {
  constructor(private readonly service: QueriesService) {}

  @Get()
  findAll(@Query('dataSourceId') dataSourceId?: string) {
    return this.service.findAll(dataSourceId);
  }

  @Post('run')
  runInline(@Body() body: RunInlineDto) {
    return this.service.runInline(body.dataSourceId, body.config);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateQueryDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQueryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/run')
  run(@Param('id') id: string) {
    return this.service.run(id);
  }
}
