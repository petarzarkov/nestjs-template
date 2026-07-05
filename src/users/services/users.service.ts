import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { OAuthProvider } from '@/auth/enum/oauth-provider.enum';
import { authProviders } from '@/auth/schema/auth-provider.schema';
import { PageDto } from '@/core/pagination/dto/page.dto';
import { password as passwordUtil } from '@/core/utils/password.util';
import { DRIZZLE_DB, type DrizzleDB } from '@/infra/db/database.module';
import { JobPublisherService } from '@/infra/queue/services/job-publisher.service';
import { EVENTS } from '@/notifications/events/events';
import {
  SanitizedUser,
  sanitizeUser,
  type User,
} from '@/users/entity/user.entity';
import { InviteStatus } from '@/users/invites/enum/invite-status.enum';
import { InvitesRepository } from '@/users/invites/repos/invites.repository';
import { invites } from '@/users/invites/schema/invite.schema';
import { UsersRepository } from '@/users/repos/users.repository';
import { users } from '@/users/schema/user.schema';
import { GetUsersQueryDto, UpdateUserDto } from '../dto/user.dto';
import { UserRole } from '../enum/user-role.enum';

type TransactionCallback = (
  tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0],
) => void;

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly invitesRepository: InvitesRepository,
    private readonly jobPublisher: JobPublisherService,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
  ) {}

  private createUserWithLocalAuth(
    email: string,
    hashedPassword: string,
    roles: UserRole[],
    additionalTransactionOps?: TransactionCallback,
  ): User {
    return this.db.transaction(tx => {
      const user = tx
        .insert(users)
        .values({
          email,
          password: hashedPassword,
          displayName: email.split('@')[0],
          roles,
        })
        .returning()
        .get();

      tx.insert(authProviders)
        .values({
          userId: user.id,
          provider: OAuthProvider.LOCAL,
          authProviderId: null,
          passwordHash: hashedPassword,
        })
        .run();

      additionalTransactionOps?.(tx);

      return user;
    });
  }

  getUsersPaginated(
    getUsersQueryDto: GetUsersQueryDto,
  ): PageDto<SanitizedUser> {
    return this.usersRepository.getUsersPaginated(getUsersQueryDto);
  }

  findById(id: string): SanitizedUser | null {
    const user = this.usersRepository.findById(id);
    return user ? sanitizeUser(user) : null;
  }

  async createUser(email: string, password: string): Promise<SanitizedUser> {
    const hashedPassword = await passwordUtil.hash(password);
    const user = this.createUserWithLocalAuth(email, hashedPassword, [
      UserRole.USER,
    ]);

    await this.jobPublisher.publishJob(
      EVENTS.ROUTING_KEYS.USER_REGISTERED,
      {
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
        type: 'direct',
      },
      { emitToAdmins: true, queue: EVENTS.QUEUES.BACKGROUND_JOBS },
    );

    return sanitizeUser(user);
  }

  async createUserFromInvite(
    inviteCode: string,
    password: string,
  ): Promise<SanitizedUser> {
    const invite = this.invitesRepository.findByCodeAndStatus(
      inviteCode,
      InviteStatus.PENDING,
    );
    if (!invite) {
      throw new ForbiddenException('Invalid invite');
    }

    if (invite.expiresAt < new Date()) {
      this.invitesRepository.update(invite.id, {
        status: InviteStatus.EXPIRED,
      });
      throw new ForbiddenException('Expired invite');
    }

    const hashedPassword = await passwordUtil.hash(password);
    const user = this.createUserWithLocalAuth(
      invite.email,
      hashedPassword,
      [invite.role],
      tx => {
        tx.update(invites)
          .set({ status: InviteStatus.ACCEPTED })
          .where(eq(invites.id, invite.id))
          .run();
      },
    );

    await this.jobPublisher.publishJob(
      EVENTS.ROUTING_KEYS.USER_REGISTERED,
      {
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
        type: 'invite',
      },
      { emitToAdmins: true, queue: EVENTS.QUEUES.BACKGROUND_JOBS },
    );

    return sanitizeUser(user);
  }

  updateUser(userId: string, updateUserDto: UpdateUserDto): SanitizedUser {
    const existing = this.usersRepository.findById(userId);
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    this.usersRepository.update(userId, updateUserDto);
    const updated = this.usersRepository.findById(userId);
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return sanitizeUser(updated);
  }
}
