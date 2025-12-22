import { Global, Module } from '@nestjs/common';
import { PaginationFactory } from './pagination.factory';

@Global()
@Module({
  providers: [PaginationFactory],
  exports: [PaginationFactory],
})
export class PaginationModule {}
