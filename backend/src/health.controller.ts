import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/auth.decorators';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return { status: 'ok', service: 'uifactory-backend', time: new Date().toISOString() };
  }
}
