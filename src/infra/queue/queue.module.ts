import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AppConfigService } from '@/config/services/app.config.service';
import { EVENTS } from '@/notifications/events/events';
import { JobDispatcherService } from './services/job-dispatcher.service';

@Global()
@Module({
  imports: [
    DiscoveryModule,
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => {
        const redisConfig = configService.getOrThrow('redis');

        return {
          connection: {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db,
          },
        };
      },
    }),
    BullModule.registerQueueAsync({
      name: EVENTS.QUEUES.NOTIFICATIONS_EVENTS,
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => {
        const redisConfig = configService.getOrThrow('redis');

        return {
          defaultJobOptions: {
            attempts: redisConfig.queues.maxRetries,
            backoff: {
              type: 'exponential',
              delay: redisConfig.queues.retryDelayMs,
            },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 500 },
          },
        };
      },
    }),
    BullModule.registerQueueAsync({
      name: EVENTS.QUEUES.BACKGROUND_JOBS,
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => {
        const redisConfig = configService.getOrThrow('redis');

        return {
          defaultJobOptions: {
            attempts: redisConfig.queues.maxRetries,
            backoff: {
              type: 'exponential',
              delay: redisConfig.queues.retryDelayMs,
            },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 500 },
          },
        };
      },
    }),
  ],
  providers: [JobDispatcherService],
  exports: [JobDispatcherService, BullModule],
})
export class QueueModule {}
