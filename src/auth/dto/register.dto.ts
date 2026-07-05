import { z } from 'zod';
import { registerWithEmailSchema } from './register-with-email.dto';
import { registerWithInviteSchema } from './register-with-invite.dto';

/**
 * Register with either email+password or invitationToken+password. Kept as a
 * `z.union` (not a createZodDto class — a class instance can't be a union) and
 * validated on the route via an explicit `new ZodValidationPipe(registerSchema)`;
 * Swagger documents it as a `oneOf` of the two sub-DTOs.
 */
export const registerSchema = z.union([
  registerWithInviteSchema,
  registerWithEmailSchema,
]);
