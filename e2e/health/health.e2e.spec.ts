import { describe, expect, test } from 'bun:test';
import { getTestContext } from '../setup/context';

describe('Health Endpoints (e2e)', () => {
  const ctx = getTestContext();

  describe('GET /api/service/health', () => {
    test('should return 200 OK with healthy status', async () => {
      const response = await ctx.api.get<{
        status: string;
        info: Record<string, { status: string }>;
      }>('/api/service/health');

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ok');
      expect(response.data.info).toHaveProperty('db');
      expect(response.data.info.db.status).toBe('up');
    });
  });

  describe('GET /api/service/up', () => {
    test('should return 200 OK with uptime', async () => {
      const response = await ctx.api.get<{ uptimeSeconds: number }>(
        '/api/service/up',
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('uptimeSeconds');
      expect(typeof response.data.uptimeSeconds).toBe('number');
    });
  });

  describe('GET /api/service/config', () => {
    test('should return 200 OK with config information', async () => {
      const response = await ctx.api.get<{
        name: string;
        version: string;
        env: string;
      }>('/api/service/config');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('version');
      expect(response.data).toHaveProperty('env');
    });
  });
});
