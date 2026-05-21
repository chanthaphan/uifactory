import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  // Any authenticated member can list templates to start a new app.
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles('admin')
  create(
    @Body() dto: { name: string; description?: string; category?: string; definition: Record<string, unknown> },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(dto, user);
  }

  @Post('from-app/:appId')
  @Roles('admin')
  createFromApp(
    @Param('appId') appId: string,
    @Body() meta: { name?: string; description?: string; category?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createFromApp(appId, meta, user);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
