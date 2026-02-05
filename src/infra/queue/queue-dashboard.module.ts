import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppConfigService } from '@/config/services/app.config.service';
import { HtmlBasicAuthMiddleware } from '@/core/middlewares/html-basic-auth.middleware';
import { EVENTS } from '@/notifications/events/events';

@Global()
@Module({
  imports: [
    BullBoardModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => {
        const logoUrl = configService.get('app.logoUrl');
        return {
          route: `/queues`,
          adapter: ExpressAdapter,
          boardOptions: {
            uiConfig: {
              boardTitle: 'Template Queues',
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
      name: EVENTS.QUEUES.NOTIFICATIONS_EVENTS,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: EVENTS.QUEUES.BACKGROUND_JOBS,
      adapter: BullMQAdapter,
    }),
  ],
  providers: [],
  exports: [],
})
export class QueueDashboardModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HtmlBasicAuthMiddleware).forRoutes('/queues');
  }
}
