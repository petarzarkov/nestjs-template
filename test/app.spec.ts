import type { INestApplication } from '@nestjs/common';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { createTestApp } from './utils';

describe('App E2E', () => {
  let app: INestApplication;

  before(async () => {
    app = await createTestApp();
  });

  after(async () => {
    await app.close();
  });

  test('GET /health should return 200', async () => {
    const server = app.getHttpServer();
    const response = await request(server).get('/health').expect(200);

    assert.ok(response.body.status === 'ok', 'Health check should return ok status');
    assert.ok(response.body.timestamp, 'Health check should include timestamp');
  });
});
