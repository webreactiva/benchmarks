import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/test-app.js';

let harness: TestApp;

describe('rate limiting distribuido', () => {
  beforeAll(async () => {
    harness = await createTestApp({
      RATE_LIMIT_ENABLED: 'true',
      RATE_LIMIT_CAPACITY: '5',
      RATE_LIMIT_REFILL_PER_SECOND: '1',
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  it('bloquea con 429 cuando se supera el cupón del usuario', async () => {
    const headers = { 'x-session-id': 'sesion-limitada' };

    const statuses: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/v1/carts/no-existe',
        headers,
      });
      statuses.push(response.statusCode);
    }

    expect(statuses.slice(0, 5).every((s) => s !== 429)).toBe(true);
    expect(statuses.slice(5)).toContain(429);

    const limited = await harness.app.inject({
      method: 'GET',
      url: '/v1/carts/no-existe',
      headers,
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe('RATE_LIMITED');
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('el límite es por identidad, no global', async () => {
    const other = { 'x-session-id': 'sesion-otra' };
    const response = await harness.app.inject({
      method: 'GET',
      url: '/v1/carts/no-existe',
      headers: other,
    });
    expect(response.statusCode).toBe(404);
  });

  it('no limita las rutas de operación (/healthz)', async () => {
    for (let i = 0; i < 20; i += 1) {
      const response = await harness.app.inject({ method: 'GET', url: '/healthz' });
      expect(response.statusCode).toBe(200);
    }
  });
});
