import { afterEach, describe, expect, test } from 'bun:test';
import type { AuditLog } from '@/audit/entity/audit-log.entity';
import { AuditAction } from '@/audit/enum/audit-action.enum';
import { E2E_ADMIN, getTestContext } from '../setup/context';

interface AuditLogResponse {
  data: AuditLog[];
  meta: {
    take: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor: string | null;
    previousCursor: string | null;
  };
}

describe('Audit Logs (e2e)', () => {
  const ctx = getTestContext();

  afterEach(() => {
    ctx.reset();
  });

  describe('User INSERT audit', () => {
    test('should create an audit log when a new user registers and return it via API', async () => {
      const testEmail = `audit-insert-${Date.now()}@e2e-test.com`;
      const testPassword = 'TestPass123!';

      const response = await ctx.api.post<{ accessToken: string }>(
        '/api/auth/register',
        {
          email: testEmail,
          password: testPassword,
        },
      );

      expect(response.status).toBe(201);

      const user = await ctx.db.getUserByEmail(testEmail);
      expect(user).toBeDefined();

      // Verify audit log via DB
      const auditLog = await ctx.db.auditLogs.findOne({
        where: {
          entityName: 'User',
          entityId: user?.id,
          action: AuditAction.INSERT,
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe(AuditAction.INSERT);
      expect(auditLog?.entityName).toBe('User');
      expect(auditLog?.entityId).toBe(user?.id);
      expect(auditLog?.oldValue).toBeNull();
      expect(auditLog?.newValue).toBeDefined();
      expect(auditLog?.newValue?.email).toBe(testEmail);
      // Password should be excluded from audit log
      expect(auditLog?.newValue?.password).toBeUndefined();

      // Verify audit log via API controller
      await ctx.loginAsAdmin();
      const apiResponse = await ctx.api.get<AuditLogResponse>(
        `/api/audit-logs?entityId=${user?.id}&action=INSERT`,
      );

      expect(apiResponse.status).toBe(200);
      expect(apiResponse.data.data.length).toBeGreaterThanOrEqual(1);

      const apiAuditLog = apiResponse.data.data.find(
        log => log.entityId === user?.id && log.entityName === 'User',
      );
      expect(apiAuditLog).toBeDefined();
      expect(apiAuditLog?.action).toBe(AuditAction.INSERT);
      expect(apiAuditLog?.newValue?.email).toBe(testEmail);
      expect(apiAuditLog?.newValue?.password).toBeUndefined();
      expect(apiAuditLog?.oldValue).toBeNull();

      // Clean up
      await ctx.db.auditLogs.delete({ entityId: user?.id });
      await ctx.db.users.delete({ id: user?.id });
    });
  });

  describe('User UPDATE audit', () => {
    test('should create an audit log when a user is suspended and return it via API', async () => {
      // Register a test user
      const testEmail = `audit-update-${Date.now()}@e2e-test.com`;
      const testPassword = 'TestPass123!';

      await ctx.api.post('/api/auth/register', {
        email: testEmail,
        password: testPassword,
      });

      const user = await ctx.db.getUserByEmail(testEmail);
      expect(user).toBeDefined();

      // Login as admin and suspend the user
      await ctx.loginAsAdmin();

      const suspendResponse = await ctx.api.post(
        `/api/users/${user?.id}/suspend`,
      );
      expect(suspendResponse.status).toBe(201);

      // Verify audit log via DB
      const auditLog = await ctx.db.auditLogs.findOne({
        where: {
          entityName: 'User',
          entityId: user?.id,
          action: AuditAction.UPDATE,
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe(AuditAction.UPDATE);
      expect(auditLog?.oldValue).toBeDefined();
      expect(auditLog?.newValue).toBeDefined();
      expect(auditLog?.oldValue?.suspended).toBe(false);
      expect(auditLog?.newValue?.suspended).toBe(true);
      // Actor should be the admin user
      const admin = await ctx.db.getUserByEmail(E2E_ADMIN.email);
      expect(auditLog?.actorId).toBe(admin?.id);

      // Verify audit log via API controller with multiple filters
      const apiResponse = await ctx.api.get<AuditLogResponse>(
        `/api/audit-logs?entityId=${user?.id}&action=UPDATE&entityName=User`,
      );

      expect(apiResponse.status).toBe(200);
      expect(apiResponse.data.data.length).toBeGreaterThanOrEqual(1);

      const apiAuditLog = apiResponse.data.data.find(
        log => log.entityId === user?.id,
      );
      expect(apiAuditLog).toBeDefined();
      expect(apiAuditLog?.action).toBe(AuditAction.UPDATE);
      expect(apiAuditLog?.actorId).toBe(admin?.id);
      expect(apiAuditLog?.oldValue?.suspended).toBe(false);
      expect(apiAuditLog?.newValue?.suspended).toBe(true);

      // Clean up
      await ctx.db.auditLogs.delete({ entityId: user?.id });
      await ctx.db.users.delete({ id: user?.id });
    });
  });

  describe('GET /api/audit-logs', () => {
    test('should return cursor pagination meta on first page', async () => {
      await ctx.loginAsAdmin();

      const response = await ctx.api.get<AuditLogResponse>('/api/audit-logs');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(response.data).toHaveProperty('meta');
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.meta).toHaveProperty('take');
      expect(response.data.meta).toHaveProperty('hasNextPage');
      expect(response.data.meta).toHaveProperty('hasPreviousPage');
      expect(response.data.meta).toHaveProperty('nextCursor');
      expect(response.data.meta).toHaveProperty('previousCursor');
      // First page should never have a previous cursor
      expect(response.data.meta.hasPreviousPage).toBe(false);
      expect(response.data.meta.previousCursor).toBeNull();
    });

    test('should paginate forward using cursor with no duplicate IDs', async () => {
      await ctx.loginAsAdmin();

      const page1 = await ctx.api.get<AuditLogResponse>(
        '/api/audit-logs?take=2',
      );
      expect(page1.status).toBe(200);
      expect(page1.data.data.length).toBeLessThanOrEqual(2);

      if (page1.data.meta.nextCursor) {
        const page2 = await ctx.api.get<AuditLogResponse>(
          `/api/audit-logs?take=2&cursor=${page1.data.meta.nextCursor}`,
        );
        expect(page2.status).toBe(200);
        expect(page2.data.meta.hasPreviousPage).toBe(true);
        expect(page2.data.meta.previousCursor).not.toBeNull();

        // No overlap between pages
        const page1Ids = new Set(page1.data.data.map(d => d.id));
        for (const entry of page2.data.data) {
          expect(page1Ids.has(entry.id)).toBe(false);
        }
      }
    });

    test('should navigate backward without overlapping page 2', async () => {
      await ctx.loginAsAdmin();

      const page1 = await ctx.api.get<AuditLogResponse>(
        '/api/audit-logs?take=2',
      );
      expect(page1.status).toBe(200);
      if (!page1.data.meta.nextCursor) return;

      const page2 = await ctx.api.get<AuditLogResponse>(
        `/api/audit-logs?take=2&cursor=${page1.data.meta.nextCursor}`,
      );
      expect(page2.status).toBe(200);
      expect(page2.data.meta.previousCursor).not.toBeNull();

      // Go backward from page 2
      const backPage = await ctx.api.get<AuditLogResponse>(
        `/api/audit-logs?take=2&cursor=${page2.data.meta.previousCursor}&direction=backward`,
      );
      expect(backPage.status).toBe(200);

      // Backward page should not overlap with page 2
      const page2Ids = new Set(page2.data.data.map(d => d.id));
      for (const entry of backPage.data.data) {
        expect(page2Ids.has(entry.id)).toBe(false);
      }

      // Backward page should indicate there is a next page
      expect(backPage.data.meta.hasNextPage).toBe(true);
      expect(backPage.data.meta.nextCursor).not.toBeNull();
    });

    test('should reject an invalid cursor', async () => {
      await ctx.loginAsAdmin();

      const response = await ctx.api.get<{ message: string }>(
        '/api/audit-logs?cursor=not-a-valid-cursor',
      );
      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    test('should filter audit logs by entityName', async () => {
      await ctx.loginAsAdmin();

      const response = await ctx.api.get<AuditLogResponse>(
        '/api/audit-logs?entityName=User',
      );

      expect(response.status).toBe(200);
      for (const entry of response.data.data) {
        expect(entry.entityName).toBe('User');
      }
    });

    test('should filter audit logs by action', async () => {
      await ctx.loginAsAdmin();

      const response = await ctx.api.get<AuditLogResponse>(
        '/api/audit-logs?action=INSERT',
      );

      expect(response.status).toBe(200);
      for (const entry of response.data.data) {
        expect(entry.action).toBe(AuditAction.INSERT);
      }
    });

    test('should filter audit logs by actorId', async () => {
      await ctx.loginAsAdmin();
      const admin = await ctx.db.getUserByEmail(E2E_ADMIN.email);

      const response = await ctx.api.get<AuditLogResponse>(
        `/api/audit-logs?actorId=${admin?.id}`,
      );

      expect(response.status).toBe(200);
      for (const entry of response.data.data) {
        // biome-ignore lint/style/noNonNullAssertion: sd
        // biome-ignore lint/suspicious/noNonNullAssertedOptionalChain: sd
        expect(entry.actorId).toBe(admin?.id!);
      }
    });

    test('should reject unauthenticated requests', async () => {
      ctx.api.clearAuthToken();

      const response = await ctx.api.get('/api/audit-logs');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    test('should reject non-admin users', async () => {
      const testEmail = `audit-nonadmin-${Date.now()}@e2e-test.com`;
      const testPassword = 'TestPass123!';

      const registerResponse = await ctx.api.post<{ accessToken: string }>(
        '/api/auth/register',
        {
          email: testEmail,
          password: testPassword,
        },
      );

      expect(registerResponse.status).toBe(201);

      // Use the regular user's token
      ctx.api.setAuthToken(registerResponse.data.accessToken);

      const response = await ctx.api.get('/api/audit-logs');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);

      // Clean up
      const user = await ctx.db.getUserByEmail(testEmail);
      if (user) {
        await ctx.db.auditLogs.delete({ entityId: user.id });
        await ctx.db.users.delete({ id: user.id });
      }
    });
  });
});
