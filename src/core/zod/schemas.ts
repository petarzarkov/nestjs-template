import { z } from 'zod';
import { STRING_LENGTH } from '@/constants';

/**
 * Shared Zod field schemas (replace the old class-validator custom decorators
 * `@Email`, `@Password`).
 */

export const emailSchema = z
  .email()
  .max(STRING_LENGTH.EMAIL_MAX)
  .describe('The email address of the user.');

/** Strong password: 8–64 chars, at least one lower/upper/number/symbol. */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(64, 'Password must be at most 64 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol')
  .describe('Password.');
