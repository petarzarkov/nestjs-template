import { applyDecorators, SetMetadata } from '@nestjs/common';
import { JOB_HANDLER_METADATA } from '@/constants';
import {
  type QueueType,
  type RoutingKeyType,
} from '@/notifications/events/events';

export interface JobHandlerOptions {
  queue: QueueType;
  name: RoutingKeyType;
}

export function JobHandler(options: JobHandlerOptions) {
  return applyDecorators(SetMetadata(JOB_HANDLER_METADATA, options));
}
