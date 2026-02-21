import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/core/decorators/public.decorator';
import { SanitizedUser } from '@/users/entity/user.entity';
import { SubscriptionStatus } from '../enum/subscription-status.enum';
import { SubscriptionRepository } from '../repos/subscription.repository';

const ACTIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
];

@Injectable()
export class ActiveSubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionRepo: SubscriptionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const { user }: { user: SanitizedUser } = context
      .switchToHttp()
      .getRequest();

    if (!user) return false;

    const subscription = await this.subscriptionRepo.findByUserId(user.id);

    if (!subscription || !ACTIVE_STATUSES.includes(subscription.status)) {
      throw new ForbiddenException(
        'An active subscription is required to access this resource.',
      );
    }

    return true;
  }
}
