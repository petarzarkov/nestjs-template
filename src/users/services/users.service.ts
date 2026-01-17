import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuthProvider } from '@/auth/entity/auth-provider.entity';
import { OAuthProvider } from '@/auth/enum/oauth-provider.enum';
import { PageDto } from '@/core/pagination/dto/page.dto';
import { password as passwordUtil } from '@/core/utils/password.util';
import { JobPublisherService } from '@/infra/queue/services/job-publisher.service';
import { EVENT_CONSTANTS } from '@/notifications/events/events';
import { SanitizedUser, User } from '@/users/entity/user.entity';
import { InviteStatus } from '@/users/invites/enum/invite-status.enum';
import { InvitesRepository } from '@/users/invites/repos/invites.repository';
import { UsersRepository } from '@/users/repos/users.repository';
import { GetUsersQueryDto, UpdateUserDto } from '../dto/user.dto';
import { UserRole } from '../enum/user-role.enum';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly invitesRepository: InvitesRepository,
    private readonly jobPublisher: JobPublisherService,
    @InjectEntityManager() readonly entityManager: EntityManager,
  ) {}

  private async createUserWithLocalAuth(
    email: string,
    hashedPassword: string,
    roles: UserRole[],
    additionalTransactionOps?: (txManager: EntityManager) => Promise<void>,
  ): Promise<User> {
    return this.entityManager.transaction(async txManager => {
      const user = txManager.create(User, {
        email,
        password: hashedPassword,
        displayName: email.split('@')[0],
        roles,
      });
      const savedUser = await txManager.save(User, user);

      const authProvider = txManager.create(AuthProvider, {
        userId: savedUser.id,
        provider: OAuthProvider.LOCAL,
        authProviderId: null,
        passwordHash: hashedPassword,
      });
      await txManager.save(AuthProvider, authProvider);

      if (additionalTransactionOps) {
        await additionalTransactionOps(txManager);
      }

      return savedUser;
    });
  }

  async getUsersPaginated(
    getUsersQueryDto: GetUsersQueryDto,
  ): Promise<PageDto<SanitizedUser>> {
    return this.usersRepository.getUsersPaginated(getUsersQueryDto);
  }

  async findById(id: string): Promise<SanitizedUser | null> {
    return this.usersRepository.findById(id);
  }

  async createUser(email: string, password: string) {
    const hashedPassword = await passwordUtil.hash(password);
    const user = await this.createUserWithLocalAuth(email, hashedPassword, [
      UserRole.USER,
    ]);

    // Publish user registered event
    await this.jobPublisher.publishJob(
      EVENT_CONSTANTS.ROUTING_KEYS.USER_REGISTERED,
      {
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
        type: 'direct',
      },
      { emitToAdmins: true },
    );

    return user;
  }

  async createUserFromInvite(inviteCode: string, password: string) {
    const invite = await this.invitesRepository.findOne({
      where: {
        inviteCode,
        status: InviteStatus.PENDING,
      },
    });
    if (!invite) {
      throw new ForbiddenException('Invalid invite');
    }

    if (invite.expiresAt < new Date()) {
      invite.status = InviteStatus.EXPIRED;
      await this.invitesRepository.save(invite);
      throw new ForbiddenException('Expired invite');
    }

    const hashedPassword = await passwordUtil.hash(password);
    const user = await this.createUserWithLocalAuth(
      invite.email,
      hashedPassword,
      [invite.role],
      async txManager => {
        invite.status = InviteStatus.ACCEPTED;
        await txManager.save(invite);
      },
    );

    await this.jobPublisher.publishJob(
      EVENT_CONSTANTS.ROUTING_KEYS.USER_REGISTERED,
      {
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
        type: 'invite',
      },
      { emitToAdmins: true },
    );

    return user;
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const toUpdateUserDto = {
      ...user,
      ...updateUserDto,
    };
    return this.usersRepository.save(toUpdateUserDto);
  }
}
