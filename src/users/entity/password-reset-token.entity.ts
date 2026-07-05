import { z } from 'zod';

export const passwordResetTokenSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  token: z.string(),
  used: z.boolean(),
  expiresAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** Row type only (not an API DTO). */
export type PasswordResetToken = z.infer<typeof passwordResetTokenSchema>;
