import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AppConfigService } from '@/config/services/app.config.service';
import { HtmlBasicAuthMiddleware } from '@/core/middlewares/html-basic-auth.middleware';
import { EVENT_CONSTANTS } from '@/notifications/events/events';
import { JobDispatcherService } from './services/job-dispatcher.service';

@Global()
@Module({
  imports: [
    DiscoveryModule,
    BullModule.registerQueueAsync({
      name: EVENT_CONSTANTS.QUEUES.NOTIFICATIONS_EVENTS,
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
            removeOnComplete: { count: 10 },
            removeOnFail: { count: 100 },
          },
        };
      },
    }),
    BullModule.registerQueueAsync({
      name: EVENT_CONSTANTS.QUEUES.BACKGROUND_JOBS,
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
            removeOnComplete: { count: 10 },
            removeOnFail: { count: 100 },
          },
        };
      },
    }),
    BullBoardModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => {
        const logoUrl = configService.get('app.logoUrl');
        return {
          route: `/queues`,
          adapter: ExpressAdapter,
          boardOptions: {
            uiConfig: {
              boardTitle: 'NestJS Queues',
              boardLogo: {
                path: logoUrl,
              },
              favIcon: {
                default: logoUrl,
                alternative: logoUrl,
              },
            },
          },
        };
      },
    }),
    BullBoardModule.forFeature({
      name: EVENT_CONSTANTS.QUEUES.NOTIFICATIONS_EVENTS,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: EVENT_CONSTANTS.QUEUES.BACKGROUND_JOBS,
      adapter: BullMQAdapter,
    }),
  ],
  providers: [JobDispatcherService],
  exports: [JobDispatcherService, BullModule],
})
export class QueueModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HtmlBasicAuthMiddleware).forRoutes('/queues');
  }
}
