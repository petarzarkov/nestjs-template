/**
 * E2E Test Constants
 * Uses lazy getters to ensure env is loaded before access
 */

/**
 * Get E2E configuration (lazy-loaded from environment)
 */
export function getE2EConfig() {
  return {
    API_URL: process.env.E2E_API_URL || 'http://localhost:2999',
    WS_URL: process.env.E2E_WS_URL || 'ws://localhost:2999/ws',
    DB: {
      // SQLite file shared with the app-under-test (must match its SQLITE_DB_PATH).
      PATH: process.env.SQLITE_DB_PATH || './.tmp/e2e.db',
    },
    TEST_PASSWORD: process.env.E2E_TEST_PASSWORD || 'Test123$',
  };
}

// Re-export for convenience (evaluated at runtime)
export const E2E = {
  get API_URL() {
    return getE2EConfig().API_URL;
  },
  get WS_URL() {
    return getE2EConfig().WS_URL;
  },
  get DB() {
    return getE2EConfig().DB;
  },
  get TEST_PASSWORD() {
    return getE2EConfig().TEST_PASSWORD;
  },
};
