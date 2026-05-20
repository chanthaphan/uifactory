import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { AppsService } from './apps.service';
import { CreateAppDto, UpdateAppDto } from './dto/app.dto';

@Controller('apps')
export class AppsController {
  constructor(private readonly service: AppsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/data')
  runData(@Param('id') id: string) {
    return this.service.runData(id);
  }

  @Post()
  create(@Body() dto: CreateAppDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAppDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
