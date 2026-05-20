import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ExecutionModule } from './execution/execution.module';
import { DataSourcesModule } from './datasources/datasources.module';
import { QueriesModule } from './queries/queries.module';
import { AiModule } from './ai/ai.module';
import { AppsModule } from './apps/apps.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, ExecutionModule, DataSourcesModule, QueriesModule, AiModule, AppsModule],
  controllers: [HealthController],
})
export class AppModule {}
