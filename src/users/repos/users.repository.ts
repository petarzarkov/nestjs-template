import { Inject, Injectable } from '@nestjs/common';
import { and, eq, like, or } from 'drizzle-orm';
import { PageDto } from '@/core/pagination/dto/page.dto';
import { PaginationFactory } from '@/core/pagination/pagination.factory';
import { ContextLogger } from '@arkv/nestjs-context-logger';
import { DRIZZLE_DB, type DrizzleDB } from '@/infra/db/database.module';
import { GetUsersQueryDto } from '@/users/dto/user.dto';
import {
  SanitizedUser,
  sanitizeUser,
  type User,
} from '@/users/entity/user.entity';
import { UserRole } from '@/users/enum/user-role.enum';
import { type NewUserRow, users } from '@/users/schema/user.schema';

@Injectable()
export class UsersRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    protected readonly logger: ContextLogger,
    private readonly paginationFactory: PaginationFactory,
  ) {}

  getUsersPaginated(
    getUsersQueryDto: GetUsersQueryDto,
  ): PageDto<SanitizedUser> {
    const { search, suspended } = getUsersQueryDto;

    const filters = [];
    if (suspended != undefined) {
      filters.push(eq(users.suspended, suspended));
    }
    if (search) {
      const term = `%${search}%`;
      filters.push(or(like(users.email, term), like(users.displayName, term)));
    }

    const page = this.paginationFactory.paginate<User>({
      db: this.db,
      table: users,
      pageOptions: getUsersQueryDto,
      where: filters.length ? and(...filters) : undefined,
    });

    // Strip the password hash from every row before it leaves the repo.
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

  /**
   * Returns the full row including the password hash (drizzle selects all
   * columns by default — there is no TypeORM `select: false`), for local
   * credential verification.
   */
  findUserWithCredentials(email: string): User | null {
    return this.findByEmail(email);
  }

  findById(id: string): User | null {
    return this.db.select().from(users).where(eq(users.id, id)).get() ?? null;
  }

  create(user: NewUserRow): User {
    return this.db.insert(users).values(user).returning().get();
  }

  save(user: User): User {
    const { createdAt: _createdAt, ...mutable } = user;
    return this.db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: { ...mutable, updatedAt: new Date() },
      })
      .returning()
      .get();
  }

  update(userId: string, partialEntity: Partial<NewUserRow>): void {
    this.db.update(users).set(partialEntity).where(eq(users.id, userId)).run();
  }

  findByRole(role: UserRole): User[] {
    // `roles` is a JSON-encoded text array; match membership on the encoded value.
    return this.db
      .select()
      .from(users)
      .where(like(users.roles, `%"${role}"%`))
      .all();
  }
}
