import type { DynamicModule } from '@nestjs/common';
import { forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule } from '@/config/app.config.module';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { UsersModule } from '@/users/users.module';
import { EventsGateway } from './events.gateway';

export class EventsModule {
  static forRoot(): DynamicModule {
    return {
      module: EventsModule,
      global: true,
      imports: [
        forwardRef(() => UsersModule),
        JwtModule.registerAsync({
          imports: [AppConfigModule],
          useFactory: async (
            configService: AppConfigService<ValidatedConfig>,
          ) => ({
            secret: configService.getOrThrow('jwt.secret'),
            signOptions: {
              expiresIn: configService.getOrThrow('jwt.expiration'),
            },
          }),
          inject: [AppConfigService<ValidatedConfig>],
        }),
      ],
      providers: [EventsGateway],
      exports: [EventsGateway],
    };
  }
}
