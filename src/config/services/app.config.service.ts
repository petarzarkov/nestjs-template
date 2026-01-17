import { ConfigService, Path } from '@nestjs/config';
import { ValidatedConfig } from '../env.validation';

/**
 * A custom, pre-typed wrapper around the NestJS ConfigService.
 * This service is automatically aware of the `ValidatedConfig` type structure.
 */
export class AppConfigService<
  IValidatedConfig = ValidatedConfig,
> extends ConfigService<IValidatedConfig, true> {
  /**
   * A simplified getter that automatically infers the return type
   * of a top-level key from the `ValidatedConfig` object.
   *
   * @example
   * const dbConfig = this.configService.get('db');
   * // typeof dbConfig is { host: string; port: number; ... }
   *
   * @param propertyPath The top-level key of the configuration object.
   * @returns The configuration object for the specified key.
   */
  public override get<P extends Path<IValidatedConfig>>(propertyPath: P) {
    return super.get(propertyPath, { infer: true });
  }

  public override getOrThrow<P extends Path<IValidatedConfig>>(
    propertyPath: P,
  ) {
    return super.getOrThrow(propertyPath, { infer: true });
  }
}
