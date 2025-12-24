import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { PasswordResetToken } from '@/users/entity/password-reset-token.entity';

@Injectable()
export class PasswordResetTokensRepository {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    protected readonly logger: ContextLogger,
  ) {}

  createToken(userId: string, passwordResetToken: string) {
    return this.passwordResetTokenRepository.insert({
      user: { id: userId },
      token: passwordResetToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      used: false,
    });
  }

  invalidateUserTokens(userId: string) {
    return this.passwordResetTokenRepository.update(
      { user: { id: userId }, used: false },
      { used: true },
    );
  }

  findValid(token: string): Promise<PasswordResetToken | null> {
    return this.passwordResetTokenRepository.findOne({
      where: {
        token,
        used: false,
        expiresAt: MoreThan(new Date()),
      },
    });
  }
}
