import { Global, Module } from '@nestjs/common';
import { AppAccessService } from './app-access.service';

@Global()
@Module({
  providers: [AppAccessService],
  exports: [AppAccessService],
})
export class AppAccessModule {}
