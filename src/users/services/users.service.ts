import { password as passwordUtil } from '@/core/utils/password.util';
import { SanitizedUser } from '@/users/entity/user.entity';
import { InviteStatus } from '@/users/invites/enum/invite-status.enum';
import { InvitesRepository } from '@/users/invites/repos/invites.repository';
import { UsersRepository } from '@/users/repos/users.repository';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { PageDto } from '@/core/pagination/dto/page.dto';
import { GetUsersQueryDto, UpdateUserDto } from '../dto/user.dto';
import { UserRole } from '../enum/user-role.enum';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly invitesRepository: InvitesRepository,
    @InjectEntityManager() private readonly entityManager: EntityManager,
  ) {}

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
    const roles = [UserRole.USER];
    const user = await this.usersRepository.create({
      email,
      password: hashedPassword,
      roles,
    });

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
    const user = await this.usersRepository.create({
      email: invite.email,
      password: hashedPassword,
      roles: [invite.role],
    });
    invite.status = InviteStatus.ACCEPTED;
    await this.invitesRepository.save(invite);

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
