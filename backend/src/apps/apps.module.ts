import { Module } from '@nestjs/common';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';
import { QueriesModule } from '../queries/queries.module';

@Module({
  imports: [QueriesModule],
  controllers: [AppsController],
  providers: [AppsService],
})
export class AppsModule {}
