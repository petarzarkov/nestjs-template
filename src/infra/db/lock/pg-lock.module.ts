import { Global, Module } from '@nestjs/common';
import { PgLockService } from './pg-lock.service';

@Global()
@Module({
  providers: [PgLockService],
  exports: [PgLockService],
})
export class PgLockModule {}
