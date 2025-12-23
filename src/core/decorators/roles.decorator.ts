import type { UserRole } from '@/users/enum/user-role.enum';
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * User needs to have one of the specified roles
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const REQUIRE_ALL_ROLES_KEY = 'requireAllRoles';

/**
 * When used with @Roles, requires the user to have ALL specified roles.
 * If this decorator is not present, the user only needs to have at least one of the roles.
 */
export const RequireAllRoles = () => SetMetadata(REQUIRE_ALL_ROLES_KEY, true);
