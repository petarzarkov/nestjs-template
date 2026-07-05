import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import { ContextLogger } from '@arkv/nestjs-context-logger';
import { DRIZZLE_DB, type DrizzleDB } from '@/infra/db/database.module';
import { PasswordResetToken } from '@/users/entity/password-reset-token.entity';
import { passwordResetTokens } from '@/users/schema/password-reset-token.schema';

@Injectable()
export class PasswordResetTokensRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    protected readonly logger: ContextLogger,
  ) {}

  createToken(userId: string, passwordResetToken: string): void {
    this.db
      .insert(passwordResetTokens)
      .values({
        userId,
        token: passwordResetToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        used: false,
      })
      .run();
  }

  invalidateUserTokens(userId: string): void {
    this.db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          eq(passwordResetTokens.used, false),
        ),
      )
      .run();
  }

  findValid(token: string): PasswordResetToken | null {
    return (
      this.db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            eq(passwordResetTokens.used, false),
            gt(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .get() ?? null
    );
  }
}
