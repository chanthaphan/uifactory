import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ConnectorsService } from './connectors.service';
import { CreateConnectorDto, UpdateConnectorDto } from './dto/connector.dto';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';

@Controller('connectors')
export class ConnectorsController {
  constructor(private readonly service: ConnectorsService) {}

  // Any authenticated member can browse the connector catalog to add one to their app.
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateConnectorDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateConnectorDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
