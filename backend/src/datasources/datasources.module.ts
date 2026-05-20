import { Module } from '@nestjs/common';
import { DataSourcesController } from './datasources.controller';
import { DataSourcesService } from './datasources.service';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [ExecutionModule],
  controllers: [DataSourcesController],
  providers: [DataSourcesService],
  exports: [DataSourcesService],
})
export class DataSourcesModule {}
