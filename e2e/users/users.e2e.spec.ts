import { afterEach, describe, expect, test } from 'bun:test';
import type { SanitizedUser } from '@/users/entity/user.entity';
import { getTestContext } from '../setup/context';

interface UsersResponse {
  data: SanitizedUser[];
  meta: {
    take: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor: string | null;
    previousCursor: string | null;
  };
}

describe('Users Cursor Pagination (e2e)', () => {
  const ctx = getTestContext();
  const createdUserIds: string[] = [];

  afterEach(() => {
    ctx.reset();
  });

  test('should return cursor pagination meta on first page', async () => {
    await ctx.loginAsAdmin();

    const response = await ctx.api.get<UsersResponse>('/api/users?take=5');

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('data');
    expect(response.data).toHaveProperty('meta');
    expect(Array.isArray(response.data.data)).toBe(true);
    expect(response.data.meta.take).toBe(5);
    expect(response.data.meta.hasPreviousPage).toBe(false);
    expect(response.data.meta.previousCursor).toBeNull();
    expect(typeof response.data.meta.hasNextPage).toBe('boolean');
  });

  test('should paginate forward through users with no duplicates', async () => {
    // Wait for throttle window to reset (short throttle: 10 req/1s)
    await Bun.sleep(1100);
    await ctx.loginAsAdmin();

    // Create extra users to ensure multiple pages
    for (let i = 0; i < 3; i++) {
      const email = `cursor-test-${Date.now()}-${i}@e2e-test.com`;
      const res = await ctx.api.post<{ accessToken: string }>(
        '/api/auth/register',
        { email, password: 'TestPass123!' },
      );
      expect(res.status).toBe(201);
      const user = await ctx.db.getUserByEmail(email);
      if (user) createdUserIds.push(user.id);
    }

    await ctx.loginAsAdmin();

    // Page 1
    const page1 = await ctx.api.get<UsersResponse>('/api/users?take=2');
    expect(page1.status).toBe(200);
    expect(page1.data.data.length).toBe(2);
    expect(page1.data.meta.hasPreviousPage).toBe(false);

    if (!page1.data.meta.nextCursor) return;
    expect(page1.data.meta.hasNextPage).toBe(true);

    // Page 2
    const page2 = await ctx.api.get<UsersResponse>(
      `/api/users?take=2&cursor=${page1.data.meta.nextCursor}`,
    );
    expect(page2.status).toBe(200);
    expect(page2.data.meta.hasPreviousPage).toBe(true);
    expect(page2.data.meta.previousCursor).not.toBeNull();

    // Verify no overlap
    const page1Ids = new Set(page1.data.data.map(u => u.id));
    for (const user of page2.data.data) {
      expect(page1Ids.has(user.id)).toBe(false);
    }

    // Clean up
    for (const id of createdUserIds) {
      await ctx.db.auditLogs.delete({ entityId: id });
      await ctx.db.users.delete({ id });
    }
    createdUserIds.length = 0;
  });

  test('should navigate backward without overlapping page 2', async () => {
    // Wait for throttle window to reset (short throttle: 10 req/1s)
    await Bun.sleep(1100);
    await ctx.loginAsAdmin();

    // Create extra users
    for (let i = 0; i < 3; i++) {
      const email = `cursor-back-${Date.now()}-${i}@e2e-test.com`;
      const res = await ctx.api.post<{ accessToken: string }>(
        '/api/auth/register',
        { email, password: 'TestPass123!' },
      );
      expect(res.status).toBe(201);
      const user = await ctx.db.getUserByEmail(email);
      if (user) createdUserIds.push(user.id);
    }

    await ctx.loginAsAdmin();

    // Page 1
    const page1 = await ctx.api.get<UsersResponse>('/api/users?take=2');
    expect(page1.status).toBe(200);
    if (!page1.data.meta.nextCursor) return;

    // Page 2
    const page2 = await ctx.api.get<UsersResponse>(
      `/api/users?take=2&cursor=${page1.data.meta.nextCursor}`,
    );
    expect(page2.status).toBe(200);
    expect(page2.data.meta.previousCursor).not.toBeNull();

    // Navigate backward
    const backPage = await ctx.api.get<UsersResponse>(
      `/api/users?take=2&cursor=${page2.data.meta.previousCursor}&direction=backward`,
    );
    expect(backPage.status).toBe(200);

    // Backward page should not overlap with page 2
    const page2Ids = new Set(page2.data.data.map(u => u.id));
    for (const user of backPage.data.data) {
      expect(page2Ids.has(user.id)).toBe(false);
    }

    // Backward page should indicate there is a next page
    expect(backPage.data.meta.hasNextPage).toBe(true);
    expect(backPage.data.meta.nextCursor).not.toBeNull();

    // Clean up
    for (const id of createdUserIds) {
      await ctx.db.auditLogs.delete({ entityId: id });
      await ctx.db.users.delete({ id });
    }
    createdUserIds.length = 0;
  });

  test('should reject an invalid cursor with 400', async () => {
    // Wait for throttle window to reset (short throttle: 10 req/1s)
    await Bun.sleep(1100);
    await ctx.loginAsAdmin();

    const response = await ctx.api.get<{ message: string }>(
      '/api/users?cursor=garbage',
    );

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
  });
});
