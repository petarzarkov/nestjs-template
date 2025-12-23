import type { UserRole } from '@/users/enum/user-role.enum';

export interface AccessTokenPayload {
  sub: string; // subject
  email: string; // user email
  roles: UserRole[]; // user role names
  iat: number; // issued at
  exp: number; // unix timestamp
}
