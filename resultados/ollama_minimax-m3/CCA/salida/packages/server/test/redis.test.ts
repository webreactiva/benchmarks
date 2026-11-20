import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestContext } from './helpers.js';
import type { Container } from '../src/container.js';

const REDIS_URL = process.env.REDIS_TEST_URL;

interface CartResponse {
  cart: { id: string; version: number; lines: { productId: string; quantity: number }[] };
  totals: { total: { amount: number } };
}

/**
 * Integration tests against a real Redis instance.
 * They are skipped when REDIS_TEST_URL is not provided:
 *   REDIS_TEST_URL=redis://localhost:6379 npm test
 */
describe.skipIf(!REDIS_URL)('cart API on Redis', () => {
  let app: FastifyInstance;
  let container: Container;

  beforeAll(async () => {
    const context = await createTestContext({ REDIS_URL: REDIS_URL ?? '', LOG_LEVEL: 'silent' });
    app = context.app;
    container = context.container;
  });

  afterAll(async () => {
    await app.close();
  });

  const customer = { 'x-customer-id': 'redis-customer' };

  it('persists the cart in Redis and survives a restart of the app', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/v1/carts', headers: customer });
    const cart = (created.json() as CartResponse).cart;

    await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers: customer,
      payload: { productId: 'sku-espresso', quantity: 2 },
    });

    // A brand new container (new connection, empty local state) sees the cart.
    const other = await createTestContext({ REDIS_URL: REDIS_URL ?? '', LOG_LEVEL: 'silent' });
    const read = await other.app.inject({
      method: 'GET',
      url: `/api/v1/carts/${cart.id}`,
      headers: customer,
    });
    expect(read.statusCode).toBe(200);
    expect((read.json() as CartResponse).cart.lines[0]?.quantity).toBe(2);
    await other.app.close();
  });

  it('increments the version on every write', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/v1/carts', headers: customer });
    const cart = (created.json() as CartResponse).cart;

    await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers: customer,
      payload: { productId: 'sku-bolas', quantity: 1 },
    });
    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/carts/${cart.id}`,
      headers: customer,
    });

    expect((read.json() as CartResponse).cart.version).toBe(1);
  });

  it('detects a concurrent write with the compare and set of Redis', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/v1/carts', headers: customer });
    const cart = (created.json() as CartResponse).cart;

    const repository = container.cartService;
    expect(repository).toBeDefined();

    // Two writers with the same expected version: only one can win.
    const first = app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers: customer,
      payload: { productId: 'sku-bolas', quantity: 1 },
    });
    const second = app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers: customer,
      payload: { productId: 'sku-taza', quantity: 1 },
    });

    const [a, b] = await Promise.all([first, second]);
    expect([a.statusCode, b.statusCode].every((status) => status === 200)).toBe(true);

    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/carts/${cart.id}`,
      headers: customer,
    });
    const body = read.json() as CartResponse;
    // The losing write is replayed against the fresh state, nothing is lost.
    expect(body.cart.lines).toHaveLength(2);
  });

  it('keeps the idempotency keys in Redis', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/v1/carts', headers: customer });
    const cart = (created.json() as CartResponse).cart;

    // The key is unique per run: the Redis instance may keep the record from
    // a previous execution.
    const headers = { ...customer, 'idempotency-key': `redis-key-${Date.now()}` };
    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers,
      payload: { productId: 'sku-taza', quantity: 1 },
    });
    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers,
      payload: { productId: 'sku-taza', quantity: 1 },
    });

    expect(second.headers['idempotent-replay']).toBe('true');
    expect(first.json()).toEqual(second.json());
  });

  it('reserves the stock atomically in Redis', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/v1/carts', headers: customer });
    const cart = (created.json() as CartResponse).cart;

    await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers: customer,
      payload: { productId: 'sku-varietal', quantity: 2 },
    });
    const checkout = await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/checkout`,
      headers: customer,
    });

    expect(checkout.statusCode).toBe(200);
    expect(await container.stock.available('sku-varietal')).toBe(6);
  });

  it('reports Redis as ready', async () => {
    const ready = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(ready.statusCode).toBe(200);
    expect(ready.json().checks.redis).toBe(true);
  });
});
