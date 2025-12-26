import type { EnvVars } from '@/config/env-vars.dto';
import type { SanitizedUser } from '@/users/entity/user.entity';

declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvVars {}
  }

  namespace Express {
    interface User extends SanitizedUser {}
    interface Locals {
      startTime: number;
    }
  }
}
