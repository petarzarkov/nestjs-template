import { PASSWORD_HASH_ROUNDS } from '@/constants';

/**
 * Password hashing utilities using Bun's native password API.
 * Uses bcrypt algorithm for compatibility with existing password hashes.
 */
export const password = {
  /**
   * Hash a plaintext password using bcrypt.
   */
  hash: (plaintext: string, cost = PASSWORD_HASH_ROUNDS): Promise<string> =>
    Bun.password.hash(plaintext, { algorithm: 'bcrypt', cost }),

  /**
   * Verify a plaintext password against a bcrypt hash.
   */
  verify: (plaintext: string, hash: string): Promise<boolean> =>
    Bun.password.verify(plaintext, hash),
};
