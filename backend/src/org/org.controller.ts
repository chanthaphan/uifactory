import { Controller, Get, Query } from '@nestjs/common';
import { OrgService } from './org.service';

@Controller('org')
export class OrgController {
  constructor(private readonly service: OrgService) {}

  @Get('users')
  searchUsers(@Query('q') q = '') {
    return this.service.searchUsers(q);
  }

  @Get('status')
  status() {
    return { live: this.service.isLive() };
  }
}
