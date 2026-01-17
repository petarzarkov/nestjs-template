import { afterEach, describe, expect, test } from 'bun:test';
import { UserRole } from '@/users/enum/user-role.enum';
import { E2E } from '../constants';
import { E2E_ADMIN, getTestContext } from '../setup/context';

describe('Auth (e2e)', () => {
  const ctx = getTestContext();

  afterEach(() => {
    ctx.reset();
  });

  describe('Login', () => {
    test('should login with valid credentials', async () => {
      const result = await ctx.loginAsAdmin();

      expect(result.accessToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
    });

    test('should reject invalid credentials', async () => {
      const response = await ctx.api.post('/api/auth/login', {
        email: 'nonexistent@test.com',
        password: 'wrongpassword',
      });

      expect(response.ok).toBe(false);
      // API returns 400 for validation errors or 401 for auth failures
      expect([400, 401]).toContain(response.status);
    });
  });

  describe('User Profile', () => {
    test('should get current user profile when authenticated', async () => {
      await ctx.loginAsAdmin();

      const profile = await ctx.api.getMe();

      expect(profile.id).toBeDefined();
      expect(profile.email).toBe(E2E_ADMIN.email);
      expect(profile.roles).toContain(UserRole.ADMIN);
    });

    test('should reject unauthenticated profile request', async () => {
      ctx.api.clearAuthToken();

      const response = await ctx.api.get('/api/users/me');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe('WebSocket Connection', () => {
    test('should connect to WebSocket and receive connected event', async () => {
      const { accessToken } = await ctx.loginAsAdmin();

      ctx.ws.connect(accessToken, E2E.API_URL);
      const connectedEvent = await ctx.ws.waitForConnected(10000);

      expect(connectedEvent).toBeDefined();
      expect(connectedEvent.message).toContain('Connected');
      expect(connectedEvent.payload.email).toBe(E2E_ADMIN.email);
    });
  });

  describe('Database Direct Access', () => {
    test('should query admin user directly from database', async () => {
      const user = await ctx.db.getUserByEmail(E2E_ADMIN.email);

      expect(user).toBeDefined();
      expect(user?.email).toBe(E2E_ADMIN.email);
      expect(user?.roles).toContain(UserRole.ADMIN);
      expect(user?.suspended).toBe(false);
    });
  });

  describe('User Registration', () => {
    test('should register new user successfully', async () => {
      const testEmail = `test-${Date.now()}@e2e-test.com`;
      const testPassword = 'TestPass123!';

      const response = await ctx.api.post<{ accessToken: string }>(
        '/api/auth/register',
        {
          email: testEmail,
          password: testPassword,
        },
      );

      expect(response.status).toBe(201);
      expect(response.data.accessToken).toBeDefined();

      // Verify user was created in DB
      const user = await ctx.db.getUserByEmail(testEmail);
      expect(user).toBeDefined();
      expect(user?.email).toBe(testEmail);
      expect(user?.roles).toContain(UserRole.USER);

      // Clean up - delete the test user
      if (user) {
        await ctx.db.users.delete({ id: user.id });
      }
    });

    test('should trigger BullMQ job queue and receive WebSocket notification', async () => {
      // Connect admin WebSocket to listen for notifications
      const { accessToken } = await ctx.loginAsAdmin();
      ctx.ws.connect(accessToken, E2E.API_URL);
      await ctx.ws.waitForConnected(10000);

      // Register a new user - this should trigger Redis queues event
      const testEmail = `test-streams-${Date.now()}@e2e-test.com`;
      const testPassword = 'TestPass123!';

      const response = await ctx.api.post<{ accessToken: string }>(
        '/api/auth/register',
        {
          email: testEmail,
          password: testPassword,
        },
      );

      expect(response.status).toBe(201);

      // Wait for the WebSocket notification from BullMQ
      // Flow: Register → EventPublisherService → BullMQ Queue → NotificationProcessor → WebSocket
      const notification = await ctx.ws.waitForEvent<{
        event: string;
        payload: { email: string; name: string; type: string };
      }>('notification', 3000); // 3s timeout

      expect(notification).toBeDefined();
      expect(notification.event).toBe('user.registered');
      expect(notification.payload.email).toBe(testEmail);
      expect(notification.payload.type).toBe('direct');

      // Verify user was created in DB
      const user = await ctx.db.getUserByEmail(testEmail);
      expect(user).toBeDefined();
      expect(user?.email).toBe(testEmail);

      // Clean up - delete the test user
      if (user) {
        await ctx.db.users.delete({ id: user.id });
      }
    }, 10000); // 10s test timeout
  });
});
