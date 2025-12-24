/**
 * Bun preload script for E2E tests
 * Environment is loaded via bun --env-file flag in package.json
 */
import { afterAll, beforeAll } from 'bun:test';
import { destroyTestContext, initializeTestContext } from './context';

// Global setup - runs once before all tests
beforeAll(async () => {
  console.log('🚀 E2E Tests: Initializing test context...');
  await initializeTestContext();
  console.log('✅ E2E Tests: Test context ready');
});

// Global teardown - runs once after all tests
afterAll(async () => {
  console.log('🧹 E2E Tests: Cleaning up...');
  await destroyTestContext();
  console.log('✅ E2E Tests: Cleanup complete');
});
