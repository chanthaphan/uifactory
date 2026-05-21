import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { CurrentUser } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';

@Controller('apps/:appId/credentials')
export class CredentialsController {
  constructor(private readonly service: CredentialsService) {}

  @Get()
  list(@Param('appId') appId: string, @CurrentUser() user: AuthUser) {
    return this.service.listForApp(appId, user);
  }

  @Put(':dataSourceId')
  set(
    @Param('appId') appId: string,
    @Param('dataSourceId') dataSourceId: string,
    @Body() body: { config: Record<string, unknown> },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.set(appId, dataSourceId, body?.config, user);
  }

  @Delete(':dataSourceId')
  remove(@Param('appId') appId: string, @Param('dataSourceId') dataSourceId: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(appId, dataSourceId, user);
  }
}
