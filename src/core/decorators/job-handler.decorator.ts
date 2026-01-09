import { applyDecorators, SetMetadata } from '@nestjs/common';
import { JOB_HANDLER_METADATA } from '@/config/constants';

export interface JobHandlerOptions {
  queue: string;
  name: string;
}

export function JobHandler(queue: string, name: string) {
  return applyDecorators(SetMetadata(JOB_HANDLER_METADATA, { queue, name }));
}
