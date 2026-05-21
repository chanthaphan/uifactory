import { Module } from '@nestjs/common';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';
import { AgentService } from './agent.service';
import { QueriesModule } from '../queries/queries.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [QueriesModule, AiModule],
  controllers: [AppsController],
  providers: [AppsService, AgentService],
})
export class AppsModule {}
