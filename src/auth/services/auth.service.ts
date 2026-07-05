import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq } from 'drizzle-orm';
import { AccessTokenPayload } from '@/auth/dto/access-token-payload';
import { password as passwordUtil } from '@/core/utils/password.util';
import { DRIZZLE_DB, type DrizzleDB } from '@/infra/db/database.module';
import { JobPublisherService } from '@/infra/queue/services/job-publisher.service';
import { ContextLogger } from '@arkv/nestjs-context-logger';
import { EVENTS } from '@/notifications/events/events';
import {
  SanitizedUser,
  sanitizeUser,
  type User,
} from '@/users/entity/user.entity';
import { UserRole } from '@/users/enum/user-role.enum';
import { PasswordResetTokensRepository } from '@/users/repos/password-reset-tokens.repository';
import { UsersRepository } from '@/users/repos/users.repository';
import { users } from '@/users/schema/user.schema';
import { OAuthProvider } from '../enum/oauth-provider.enum';
import { AuthProvidersRepository } from '../repos/auth-providers.repository';
import { authProviders } from '../schema/auth-provider.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordResetTokensRepository: PasswordResetTokensRepository,
    private readonly authProvidersRepository: AuthProvidersRepository,
    private readonly jobPublisher: JobPublisherService,
    private readonly jwtService: JwtService,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly logger: ContextLogger,
  ) {}

  async validateCredentials(
    email: string,
    pass: string,
  ): Promise<SanitizedUser | null> {
    const user = this.usersRepository.findUserWithCredentials(email);
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

    return sanitizeUser(user);
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
    const user = this.usersRepository.findByEmail(email);
    if (!user) {
      // For security, do not reveal if user exists
      return;
    }
    this.passwordResetTokensRepository.invalidateUserTokens(user.id);
    const passwordResetToken = randomBytes(32).toString('hex');
    this.passwordResetTokensRepository.createToken(user.id, passwordResetToken);

    // Publish password reset event
    await this.jobPublisher.publishJob(
      EVENTS.ROUTING_KEYS.USER_PASSWORD_RESET,
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
      this.passwordResetTokensRepository.findValid(resetToken);
    if (!resetTokenEntity) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    const user = this.usersRepository.findById(resetTokenEntity.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await passwordUtil.hash(newPassword);

    // Update password in both User and AuthProvider (if LOCAL provider exists)
    this.db.transaction(tx => {
      tx.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id))
        .run();

      const localAuthProvider = tx
        .select()
        .from(authProviders)
        .where(
          and(
            eq(authProviders.userId, user.id),
            eq(authProviders.provider, OAuthProvider.LOCAL),
          ),
        )
        .get();
      if (localAuthProvider) {
        tx.update(authProviders)
          .set({ passwordHash: hashedPassword })
          .where(eq(authProviders.id, localAuthProvider.id))
          .run();
      }
    });

    this.passwordResetTokensRepository.invalidateUserTokens(user.id);
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
        this.authProvidersRepository.findByProviderAndAuthProviderId(
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
          this.usersRepository.save(user);
        }

        return sanitizeUser(user);
      }

      // Check if user with this email already exists
      const existingUser = this.usersRepository.findByEmail(email);

      let user: User;
      if (existingUser) {
        // User exists but doesn't have this OAuth provider linked
        user = existingUser;

        if (displayName && !user.displayName) {
          user.displayName = displayName;
        }
        if (picture && !user.picture) {
          user.picture = picture;
        }
        this.usersRepository.save(user);

        const existingProviderForUser =
          this.authProvidersRepository.findByUserIdAndProvider(
            user.id,
            provider,
          );

        if (!existingProviderForUser) {
          this.authProvidersRepository.save({
            userId: user.id,
            provider,
            authProviderId,
            passwordHash: null,
          });
        }
      } else {
        // Create new user and auth provider in a transaction
        user = this.db.transaction(tx => {
          const newUser = tx
            .insert(users)
            .values({
              email,
              password: null, // OAuth users don't have passwords
              roles: [UserRole.USER],
              displayName,
              picture,
            })
            .returning()
            .get();

          tx.insert(authProviders)
            .values({
              userId: newUser.id,
              provider,
              authProviderId,
              passwordHash: null,
            })
            .run();

          return newUser;
        });

        // Publish user registered event
        await this.jobPublisher.publishJob(
          EVENTS.ROUTING_KEYS.USER_REGISTERED,
          {
            email: user.email,
            name: displayName || user.email.split('@')[0],
            type: 'direct', // OAuth users are treated as direct registrations
          },
          { emitToAdmins: true, queue: EVENTS.QUEUES.BACKGROUND_JOBS },
        );
      }

      return sanitizeUser(user);
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
