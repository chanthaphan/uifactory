import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrgModule } from './org/org.module';
import { TemplatesModule } from './templates/templates.module';
import { SettingsModule } from './settings/settings.module';
import { ExecutionModule } from './execution/execution.module';
import { DataSourcesModule } from './datasources/datasources.module';
import { QueriesModule } from './queries/queries.module';
import { AiModule } from './ai/ai.module';
import { AppsModule } from './apps/apps.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    OrgModule,
    TemplatesModule,
    SettingsModule,
    ExecutionModule,
    DataSourcesModule,
    QueriesModule,
    AiModule,
    AppsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
