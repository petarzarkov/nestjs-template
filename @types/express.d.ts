import type { SanitizedUser } from '@/users/entity/user.entity';

declare global {
  namespace Express {
    interface User extends SanitizedUser {}
    interface Locals {
      startTime: number;
    }
  }
}
