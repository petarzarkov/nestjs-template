import { Injectable, NotFoundException } from '@nestjs/common';
import { PageDto } from '@/core/pagination/dto/page.dto';
import { SanitizedUser, sanitizeUser } from '@/users/entity/user.entity';
import { UsersRepository } from '@/users/repos/users.repository';
import { GetUsersQueryDto, UpdateUserDto } from '../dto/user.dto';

/**
 * User read + admin-management operations. User *creation* is owned by Better
 * Auth (`/api/auth/sign-up/email`, OAuth callbacks, invite acceptance) so it
 * always goes through `auth.api` — there are no direct-insert paths here.
 */
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  getUsersPaginated(
    getUsersQueryDto: GetUsersQueryDto,
  ): PageDto<SanitizedUser> {
    return this.usersRepository.getUsersPaginated(getUsersQueryDto);
  }

  findById(id: string): SanitizedUser | null {
    const user = this.usersRepository.findById(id);
    return user ? sanitizeUser(user) : null;
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
