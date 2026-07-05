import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { Test } from '@nestjs/testing';
import { PaginationOrder } from '@/core/pagination/enum/pagination-order.enum';
import { PaginationFactory } from '@/core/pagination/pagination.factory';
import { ContextLogger } from '@arkv/nestjs-context-logger';
import { createDrizzleClient } from '@/infra/db/client';
import { DRIZZLE_DB } from '@/infra/db/database.module';
import type { GetUsersQueryDto } from '@/users/dto/user.dto';
import { UserRole } from '@/users/enum/user-role.enum';
import { UsersRepository } from './users.repository';

/**
 * Integration test for UsersRepository.
 *
 * Wires the REAL repository, PaginationFactory, and an in-memory SQLite
 * database (`createDrizzleClient(':memory:')`) through a NestJS TestingModule —
 * only the logger is mocked. This exercises the actual Drizzle SQL, the JSON
 * `roles` column, and the cursor pagination against a live database.
 */
const query = (opts: Partial<GetUsersQueryDto>): GetUsersQueryDto =>
  opts as GetUsersQueryDto;

describe('UsersRepository (integration, in-memory SQLite)', () => {
  let repo: UsersRepository;
  let sqlite: Database;

  beforeAll(async () => {
    const client = createDrizzleClient(':memory:');
    sqlite = client.sqlite;

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersRepository,
        PaginationFactory,
        { provide: DRIZZLE_DB, useValue: client.db },
        {
          provide: ContextLogger,
          useValue: {
            log: mock(() => undefined),
            debug: mock(() => undefined),
            warn: mock(() => undefined),
            error: mock(() => undefined),
          },
        },
      ],
    }).compile();

    repo = moduleRef.get(UsersRepository);
  });

  afterAll(() => {
    sqlite.close();
  });

  it('creates a user and reads it back by email', () => {
    const created = repo.create({
      email: 'jane@test.dev',
      roles: [UserRole.USER],
    });

    expect(created.id).toBeTruthy();
    expect(repo.findByEmail('jane@test.dev')?.id).toBe(created.id);
    expect(repo.findById(created.id)?.email).toBe('jane@test.dev');
  });

  it('finds users by role via JSON array membership', () => {
    repo.create({ email: 'admin@test.dev', roles: [UserRole.ADMIN] });

    const admins = repo.findByRole(UserRole.ADMIN);
    expect(admins.some(u => u.email === 'admin@test.dev')).toBe(true);
    expect(admins.some(u => u.email === 'jane@test.dev')).toBe(false);
  });

  it('paginates by cursor and strips the password hash', () => {
    for (let i = 0; i < 5; i++) {
      repo.create({
        email: `page-${i}@test.dev`,
        password: 'hashed',
        roles: [UserRole.USER],
      });
    }

    const firstPage = repo.getUsersPaginated(
      query({ take: 2, order: PaginationOrder.DESC }),
    );
    expect(firstPage.data).toHaveLength(2);
    expect(firstPage.meta.hasNextPage).toBe(true);
    expect(firstPage.meta.nextCursor).toBeTruthy();
    // SanitizedUser must not carry the password hash.
    expect(
      (firstPage.data[0] as unknown as Record<string, unknown>).password,
    ).toBeUndefined();

    const secondPage = repo.getUsersPaginated(
      query({
        take: 2,
        order: PaginationOrder.DESC,
        cursor: firstPage.meta.nextCursor ?? undefined,
      }),
    );
    expect(secondPage.data).toHaveLength(2);

    // Pages must not overlap.
    const firstIds = new Set(firstPage.data.map(u => u.id));
    expect(secondPage.data.every(u => !firstIds.has(u.id))).toBe(true);
  });

  it('filters the paginated result by search term', () => {
    repo.create({ email: 'searchable@unique.dev', roles: [UserRole.USER] });

    const page = repo.getUsersPaginated(
      query({ take: 10, order: PaginationOrder.DESC, search: 'unique.dev' }),
    );
    expect(page.data).toHaveLength(1);
    expect(page.data[0].email).toBe('searchable@unique.dev');
  });
});
