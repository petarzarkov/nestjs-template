import { password as passwordUtil } from '@/core/utils/password.util';
import { UserRole } from '@/users/enum/user-role.enum';
import { E2E } from '../constants';
import { ApiClient } from '../utils/api-client';
import { DbClient } from '../utils/db-client';
import { WsClient } from '../utils/ws-client';

/**
 * Default admin user for e2e tests
 */
export const E2E_ADMIN = {
  email: 'admin@e2e-test.com',
  password: E2E.TEST_PASSWORD,
  roles: [UserRole.ADMIN],
};

/**
 * Global test context singleton for E2E tests
 * Provides shared instances of API, DB, and WS clients
 */
class TestContext {
  readonly api: ApiClient;
  readonly db: DbClient;
  readonly ws: WsClient;

  private initialized = false;

  constructor() {
    this.api = new ApiClient();
    this.db = new DbClient();
    this.ws = new WsClient();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.db.initialize();
    await this.ensureAdminUser();
    this.initialized = true;
  }

  /**
   * Ensure admin user exists for tests
   */
  private async ensureAdminUser(): Promise<void> {
    const existingUser = await this.db.getUserByEmail(E2E_ADMIN.email);

    if (!existingUser) {
      const hashedPassword = await passwordUtil.hash(E2E_ADMIN.password);

      await this.db.users.save({
        email: E2E_ADMIN.email,
        password: hashedPassword,
        roles: E2E_ADMIN.roles,
        suspended: false,
      });

      console.log(`✅ Created e2e admin user: ${E2E_ADMIN.email}`);
    }
  }

  async destroy(): Promise<void> {
    if (!this.initialized) return;

    this.ws.disconnect();
    await this.db.destroy();
    this.initialized = false;
  }

  /**
   * Reset state between tests
   */
  reset(): void {
    this.api.clearAuthToken();
    this.ws.disconnect();
  }

  /**
   * Login as the default admin user
   */
  async loginAsAdmin(): Promise<{ accessToken: string }> {
    return this.api.login(E2E_ADMIN.email, E2E_ADMIN.password);
  }
}

// Global singleton instance
let testContext: TestContext | null = null;

/**
 * Get the global test context
 */
export function getTestContext(): TestContext {
  if (!testContext) {
    testContext = new TestContext();
  }
  return testContext;
}

/**
 * Initialize the test context (called by preload)
 */
export async function initializeTestContext(): Promise<TestContext> {
  const ctx = getTestContext();
  await ctx.initialize();
  return ctx;
}

/**
 * Destroy the test context (called after all tests)
 */
export async function destroyTestContext(): Promise<void> {
  if (testContext) {
    await testContext.destroy();
    testContext = null;
  }
}
