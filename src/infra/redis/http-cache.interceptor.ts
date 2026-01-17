import { CACHE_MANAGER, CacheInterceptor } from '@nestjs/cache-manager';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '@/config/services/app.config.service';
import { NO_CACHE_KEY } from '@/core/decorators/no-cache.decorator';
import { SanitizedUser } from '@/users/entity/user.entity';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) protected readonly cacheManager: unknown,
    @Inject(Reflector) protected readonly reflector: Reflector,
    private readonly configService: AppConfigService,
  ) {
    super(cacheManager, reflector);
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const appConfig = this.configService.getOrThrow('app');
    // Enable global GET REST API caching only in production
    if (appConfig.nodeEnv !== 'production') {
      return next.handle();
    }

    return super.intercept(context, next);
  }

  protected trackBy(context: ExecutionContext): string | undefined {
    const noCache = this.reflector.get(NO_CACHE_KEY, context.getHandler());
    if (noCache) {
      return undefined;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: SanitizedUser }>();
    if (request.user) {
      return request.user.id;
    }

    return super.trackBy(context);
  }
}
