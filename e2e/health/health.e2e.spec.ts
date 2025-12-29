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

    test('throttling and caching', async () => {
      ctx.api.clearAuthToken();
      // Test throttling by firing requests sequentially to exceed limit of 5/second
      // Using sequential requests to avoid race conditions with Redis
      const responses: Array<{
        data: { uptimeSeconds: number };
        status: number;
        ok: boolean;
      }> = [];

      for (let i = 0; i < 6; i++) {
        const response = await ctx.api.get<{ uptimeSeconds: number }>(
          '/api/service/up',
        );
        responses.push(response);
      }

      // Count successful (200) and throttled (429) responses
      const successResponses = responses.filter(r => r.status === 200);
      const throttledResponses = responses.filter(r => r.status === 429);

      // At least one should be throttled (429) since we exceeded 5/second
      expect(throttledResponses.length).toBeGreaterThanOrEqual(1);
      expect(successResponses.length).toBeGreaterThanOrEqual(1);

      // Test caching: collect uptimeSeconds from successful responses
      const uptimeValues = successResponses.map(r => r.data.uptimeSeconds);

      // Due to caching, at least some values should be identical
      const uniqueValues = new Set(uptimeValues);
      expect(uniqueValues.size).toBeLessThan(uptimeValues.length);
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
