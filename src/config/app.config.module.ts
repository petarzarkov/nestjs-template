import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigModuleOptions } from '@nestjs/config';
import { AppConfigService } from './services/app.config.service';

@Module({})
export class AppConfigModule {
  static forRoot<ValidatedConfig extends Record<string, unknown>>(
    options: ConfigModuleOptions<ValidatedConfig> | undefined = {
      isGlobal: true,
    },
  ): DynamicModule {
    return {
      module: AppConfigModule,
      global: options.isGlobal,
      imports: [
        ConfigModule.forRoot({
          ...options,
          isGlobal: true,
          cache: true,
        }),
      ],
      providers: [AppConfigService<ValidatedConfig>],
      exports: [AppConfigService<ValidatedConfig>],
    };
  }
}
