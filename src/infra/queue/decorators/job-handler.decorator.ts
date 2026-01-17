import { applyDecorators, SetMetadata } from '@nestjs/common';
import { JOB_HANDLER_METADATA } from '@/constants';
import { EVENT_CONSTANTS } from '@/notifications/events/events';

export interface JobHandlerOptions {
  queue: (typeof EVENT_CONSTANTS.QUEUES)[keyof typeof EVENT_CONSTANTS.QUEUES];
  name: (typeof EVENT_CONSTANTS.ROUTING_KEYS)[keyof typeof EVENT_CONSTANTS.ROUTING_KEYS];
}

export function JobHandler(options: JobHandlerOptions) {
  return applyDecorators(SetMetadata(JOB_HANDLER_METADATA, options));
}
