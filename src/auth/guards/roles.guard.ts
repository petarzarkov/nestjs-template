import {
  REQUIRE_ALL_ROLES_KEY,
  ROLES_KEY,
} from '@/core/decorators/roles.decorator';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { SanitizedUser } from '@/users/entity/user.entity';
import { UserRole } from '@/users/enum/user-role.enum';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly logger: ContextLogger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required on the endpoint, allow access.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Check if the @RequireAllRoles() decorator is present.
    const requireAll = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ALL_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const { user }: { user: SanitizedUser } =
      context.switchToHttp().getRequest() || {};

    if (!user || !user.roles) {
      this.logger.error(
        'Make sure the jwt auth guard gets ran so it attaches the user to the request.',
      );
      return false;
    }

    // If requireAll is true, check if the user has every single required role.
    if (requireAll) {
      return requiredRoles.every(role => user.roles.includes(role));
    }

    // Otherwise, check if the user has at least one of the required roles.
    return requiredRoles.some(role => user.roles.includes(role));
  }
}
