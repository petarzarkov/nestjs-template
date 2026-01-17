import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/core/decorators/public.decorator';
import {
  REQUIRE_ALL_ROLES_KEY,
  ROLES_KEY,
} from '@/core/decorators/roles.decorator';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import { SanitizedUser } from '@/users/entity/user.entity';
import { UserRole } from '@/users/enum/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly logger: ContextLogger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      // If no roles are required on the endpoint, allow access.
      return true;
    }

    // Check if the @RequireAllRoles() decorator is present.
    const requireAll = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ALL_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const { user }: { user: SanitizedUser } = context
      .switchToHttp()
      .getRequest();

    if (!user || !user.roles) {
      this.logger.error(
        'Make sure the jwt auth guard gets ran so it attaches the user to the request.',
      );
      return false;
    }

    if (requireAll) {
      // If requireAll is true, check if the user has every single required role.
      return requiredRoles.every(role => user.roles.includes(role));
    }

    // Otherwise, check if the user has at least one of the required roles.
    return requiredRoles.some(role => user.roles.includes(role));
  }
}
