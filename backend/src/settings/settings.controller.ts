import { Body, Controller, Get, Put } from '@nestjs/common';
import { PlatformSettings, SettingsService } from './settings.service';
import { Public, Roles } from '../auth/auth.decorators';

@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  // Public so the login screen / branding can read the platform name.
  @Public()
  @Get()
  get() {
    return this.service.get();
  }

  @Put()
  @Roles('admin')
  update(@Body() patch: Partial<PlatformSettings>) {
    return this.service.update(patch);
  }
}
