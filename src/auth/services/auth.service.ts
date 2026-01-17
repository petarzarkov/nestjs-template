import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AccessTokenPayload } from '@/auth/dto/access-token-payload';
import { password as passwordUtil } from '@/core/utils/password.util';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import { JobPublisherService } from '@/infra/queue/services/job-publisher.service';
import { EVENT_CONSTANTS } from '@/notifications/events/events';
import { SanitizedUser, User } from '@/users/entity/user.entity';
import { UserRole } from '@/users/enum/user-role.enum';
import { PasswordResetTokensRepository } from '@/users/repos/password-reset-tokens.repository';
import { UsersRepository } from '@/users/repos/users.repository';
import { AuthProvider } from '../entity/auth-provider.entity';
import { OAuthProvider } from '../enum/oauth-provider.enum';
import { AuthProvidersRepository } from '../repos/auth-providers.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordResetTokensRepository: PasswordResetTokensRepository,
    private readonly authProvidersRepository: AuthProvidersRepository,
    private readonly jobPublisher: JobPublisherService,
    private readonly jwtService: JwtService,
    @InjectEntityManager() private readonly entityManager: EntityManager,
    private readonly logger: ContextLogger,
  ) {}

  async validateCredentials(
    email: string,
    pass: string,
  ): Promise<SanitizedUser | null> {
    const user = await this.usersRepository.findUserWithCredentials(email);
    if (!user) {
      return null;
    }

    // OAuth users don't have passwords
    if (!user.password) {
      return null;
    }

    const match = await passwordUtil.verify(pass, user.password);
    if (!match) {
      return null;
    }

    return User.sanitize(user);
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

    // Publish password reset event
    await this.jobPublisher.publishJob(
      EVENT_CONSTANTS.ROUTING_KEYS.USER_PASSWORD_RESET,
      {
        userId: user.id,
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
        resetToken: passwordResetToken,
      },
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

    const hashedPassword = await passwordUtil.hash(newPassword);

    // Update password in both User and AuthProvider (if LOCAL provider exists)
    await this.entityManager.transaction(async transactionalEntityManager => {
      user.password = hashedPassword;
      await transactionalEntityManager.save(user);

      // Update LOCAL auth provider password hash if it exists
      const localAuthProvider =
        await this.authProvidersRepository.findByUserIdAndProvider(
          user.id,
          OAuthProvider.LOCAL,
        );
      if (localAuthProvider) {
        localAuthProvider.passwordHash = hashedPassword;
        await transactionalEntityManager.save(localAuthProvider);
      }
    });

    await this.passwordResetTokensRepository.invalidateUserTokens(user.id);
    return { message: 'Password reset successful' };
  }

  async createOrUpdateUserOAuth(
    authProviderId: string,
    provider: OAuthProvider,
    email: string,
    displayName: string,
    picture: string | null,
  ): Promise<SanitizedUser> {
    try {
      // Check if auth provider already exists
      const existingAuthProvider =
        await this.authProvidersRepository.findByProviderAndAuthProviderId(
          provider,
          authProviderId,
        );

      if (existingAuthProvider?.user) {
        // User already exists, update displayName and picture if needed
        const user = existingAuthProvider.user;
        let updated = false;

        if (displayName && !user.displayName) {
          user.displayName = displayName;
          updated = true;
        }
        if (picture && !user.picture) {
          user.picture = picture;
          updated = true;
        }

        if (updated) {
          await this.usersRepository.save(user);
        }

        return User.sanitize(user);
      }

      // Check if user with this email already exists
      const existingUser = await this.usersRepository.findByEmail(email);

      let user: User;
      if (existingUser) {
        // User exists but doesn't have this OAuth provider linked
        user = existingUser;

        // Update displayName and picture if provided
        if (displayName && !user.displayName) {
          user.displayName = displayName;
        }
        if (picture && !user.picture) {
          user.picture = picture;
        }
        await this.usersRepository.save(user);

        // Check if provider is already linked to this user
        const existingProviderForUser =
          await this.authProvidersRepository.findByUserIdAndProvider(
            user.id,
            provider,
          );

        if (!existingProviderForUser) {
          // Link the OAuth provider to existing user
          await this.authProvidersRepository.save({
            userId: user.id,
            provider,
            authProviderId,
            passwordHash: null,
          });
        }
      } else {
        // Create new user and auth provider in a transaction
        const result = await this.entityManager.transaction(
          async transactionalEntityManager => {
            // Create user
            const newUser = transactionalEntityManager.create(User, {
              email,
              password: null, // OAuth users don't have passwords
              roles: [UserRole.USER],
              displayName,
              picture,
            });
            const savedUser = await transactionalEntityManager.save(
              User,
              newUser,
            );

            // Create auth provider
            const newAuthProvider = transactionalEntityManager.create(
              AuthProvider,
              {
                userId: savedUser.id,
                provider,
                authProviderId,
                passwordHash: null,
              },
            );
            await transactionalEntityManager.save(
              AuthProvider,
              newAuthProvider,
            );

            return savedUser;
          },
        );

        user = result;

        // Publish user registered event
        await this.jobPublisher.publishJob(
          EVENT_CONSTANTS.ROUTING_KEYS.USER_REGISTERED,
          {
            email: user.email,
            name: displayName || user.email.split('@')[0],
            type: 'direct', // OAuth users are treated as direct registrations
          },
          { emitToAdmins: true },
        );
      }

      return User.sanitize(user);
    } catch (error) {
      this.logger.error(
        `Error in createOrUpdateUserOAuth for ${provider} user ${email}`,
        { error },
      );
      throw new InternalServerErrorException(
        'Authentication failed during OAuth processing.',
      );
    }
  }
}
