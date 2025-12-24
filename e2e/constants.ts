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
      HOST: process.env.E2E_DB_HOST || 'localhost',
      PORT: parseInt(process.env.E2E_DB_PORT || '5438', 10),
      NAME: process.env.E2E_DB_NAME || 'pgdb',
      USER: process.env.E2E_DB_USER || 'postgres',
      PASS: process.env.E2E_DB_PASS || 'postgres',
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
