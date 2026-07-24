import { Inject, Injectable } from '@nestjs/common';
import { and, eq, like, or } from 'drizzle-orm';
import { PageDto } from '@/core/pagination/dto/page.dto';
import { PaginationFactory } from '@/core/pagination/pagination.factory';
import { BaseRepository } from '@/infra/db/base.repository';
import { DRIZZLE_DB, type DrizzleDB } from '@/infra/db/database.module';
import { GetUsersQueryDto } from '@/users/dto/user.dto';
import {
  SanitizedUser,
  sanitizeUser,
  type User,
} from '@/users/entity/user.entity';
import { UserRole } from '@/users/enum/user-role.enum';
import { users } from '@/users/schema/user.schema';

@Injectable()
export class UsersRepository extends BaseRepository<typeof users> {
  constructor(
    @Inject(DRIZZLE_DB) db: DrizzleDB,
    paginationFactory: PaginationFactory,
  ) {
    super(db, users, paginationFactory);
  }

  getUsersPaginated(
    getUsersQueryDto: GetUsersQueryDto,
  ): PageDto<SanitizedUser> {
    const { search, banned } = getUsersQueryDto;

    const filters = [];
    if (banned != undefined) {
      filters.push(eq(users.banned, banned));
    }
    if (search) {
      const term = `%${search}%`;
      filters.push(or(like(users.email, term), like(users.name, term)));
    }

    const page = this.paginate(
      getUsersQueryDto,
      filters.length ? and(...filters) : undefined,
    );

    return new PageDto(
      page.data.map(user => sanitizeUser(user)),
      page.meta,
    );
  }

  findByEmail(email: string): User | null {
    return (
      this.db.select().from(users).where(eq(users.email, email)).get() ?? null
    );
  }

  findByRole(role: UserRole): User[] {
    return this.db.select().from(users).where(eq(users.role, role)).all();
  }
}
