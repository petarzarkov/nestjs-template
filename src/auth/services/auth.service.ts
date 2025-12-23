import { AccessTokenPayload } from '@/auth/dto/access-token-payload';
import { SanitizedUser } from '@/users/entity/user.entity';
import { UserRole } from '@/users/enum/user-role.enum';
import { PasswordResetTokensRepository } from '@/users/repos/password-reset-tokens.repository';
import { UsersRepository } from '@/users/repos/users.repository';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordResetTokensRepository: PasswordResetTokensRepository,
    private jwtService: JwtService,
  ) {}

  async validateCredentials(
    email: string,
    pass: string,
  ): Promise<SanitizedUser | null> {
    const user = await this.usersRepository.findUserWithCredentials(email);
    if (!user) {
      return null;
    }

    const match = await bcrypt.compare(pass, user.password);
    if (!match) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  createAccessToken(
    userId: string,
    userEmail: string,
    userRoles: UserRole[],
  ): string {
    const payload: Partial<AccessTokenPayload> = {
      sub: userId,
      email: userEmail,
      roles: userRoles,
    };
    return this.jwtService.sign(payload);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      // For security, do not reveal if user exists
      return;
    }
    await this.passwordResetTokensRepository.invalidateUserTokens(user.id);
    const passwordResetToken = randomBytes(32).toString('hex');
    await this.passwordResetTokensRepository.createToken(
      user.id,
      passwordResetToken,
    );
  }

  async passwordReset(resetToken: string, newPassword: string) {
    const resetTokenEntity =
      await this.passwordResetTokensRepository.findValid(resetToken);
    if (!resetTokenEntity) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    const user = await this.usersRepository.findById(resetTokenEntity.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.save(user);
    await this.passwordResetTokensRepository.invalidateUserTokens(user.id);
    return { message: 'Password reset successful' };
  }
}
