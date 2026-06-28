import {
  type LoggerModuleAsyncOptions,
  type LoggerModuleConfig,
} from '@arkv/nestjs-context-logger';
import { AppConfigModule } from './app.config.module';
import { ValidatedConfig } from './env.validation';
import { AppConfigService } from './services/app.config.service';

/**
 * Shared async options for `NestJsContextLoggerModule.forRootAsync`, used by
 * both the HTTP app root and the queue worker root.
 *
 * The cast bridges our typed factory to the package's `(...args: unknown[])`
 * factory signature (`@arkv/*` enforces `no-explicit-any`, so it can't use
 * NestJS's looser `any[]`).
 */
export const loggerModuleAsyncOptions: LoggerModuleAsyncOptions = {
  imports: [AppConfigModule],
  inject: [AppConfigService],
  useFactory: ((
    configService: AppConfigService<ValidatedConfig>,
  ): LoggerModuleConfig => ({
    name: configService.getOrThrow('app.name'),
    version: configService.getOrThrow('app.version'),
    env: configService.getOrThrow('app.env'),
    level: configService.getOrThrow('log.level'),
    isDevelopment: configService.getOrThrow('app.nodeEnv') !== 'production',
    maskFields: configService.get('log.maskFields'),
    filterEvents: configService.get('log.filterEvents'),
    maxArrayLength: configService.get('log.maxArrayLength'),
  })) as LoggerModuleAsyncOptions['useFactory'],
};
