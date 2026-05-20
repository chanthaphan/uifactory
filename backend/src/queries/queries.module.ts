import { Module } from '@nestjs/common';
import { QueriesController } from './queries.controller';
import { QueriesService } from './queries.service';
import { ExecutionModule } from '../execution/execution.module';
import { DataSourcesModule } from '../datasources/datasources.module';

@Module({
  imports: [ExecutionModule, DataSourcesModule],
  controllers: [QueriesController],
  providers: [QueriesService],
  exports: [QueriesService],
})
export class QueriesModule {}
