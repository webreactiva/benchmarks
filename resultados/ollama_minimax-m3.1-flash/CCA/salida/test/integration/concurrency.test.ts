import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, type TestApp } from '../helpers/test-app.js';

let harness: TestApp;
let app: FastifyInstance;

const GUEST = { 'x-session-id': 'sesion-concurrencia' };

async function createCart() {
  const response = await app.inject({ method: 'POST', url: '/v1/carts', headers: GUEST, payload: {} });
  return response.json() as { id: string; version: number };
}

beforeAll(async () => {
  harness = await createTestApp();
  app = harness.app;
});

afterAll(async () => {
  await harness.close();
});

describe('concurrencia', () => {
  it('no pierde actualizaciones con 40 altas simultáneas del mismo producto', async () => {
    const cart = await createCart();

    const responses = await Promise.all(
      Array.from({ length: 40 }, () =>
        app.inject({
          method: 'POST',
          url: `/v1/carts/${cart.id}/items`,
          headers: GUEST,
          payload: { productId: 'prod-notebook', quantity: 1 },
        }),
      ),
    );

    expect(responses.every((r) => r.statusCode === 200)).toBe(true);

    const current = await app.inject({
      method: 'GET',
      url: `/v1/carts/${cart.id}`,
      headers: GUEST,
    });
    const body = current.json();

    expect(body.items).toHaveLength(1);
    expect(body.items[0].quantity).toBe(40);
    // cada mutación incrementa la versión: 1 (creación) + 40 altas
    expect(body.version).toBe(41);
    expect(body.totals.subtotalCents).toBe(40 * 850);
  });

  it('rechaza una de dos escrituras con la misma versión esperada', async () => {
    const cart = await createCart();

    const [first, second] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/v1/carts/${cart.id}/items`,
        headers: { ...GUEST, 'if-match': '"1"' },
        payload: { productId: 'prod-tea', quantity: 1 },
      }),
      app.inject({
        method: 'POST',
        url: `/v1/carts/${cart.id}/items`,
        headers: { ...GUEST, 'if-match': '"1"' },
        payload: { productId: 'prod-lamp', quantity: 1 },
      }),
    ]);

    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([200, 409]);

    const conflict = first.statusCode === 409 ? first : second;
    expect(conflict.json().error.code).toBe('CART_VERSION_CONFLICT');
  });

  it('mantiene la coherencia de los totales con mutaciones concurrentes de distintas líneas', async () => {
    const cart = await createCart();

    await Promise.all([
      app.inject({
        method: 'POST',
        url: `/v1/carts/${cart.id}/items`,
        headers: GUEST,
        payload: { productId: 'prod-tea', quantity: 2 },
      }),
      app.inject({
        method: 'POST',
        url: `/v1/carts/${cart.id}/items`,
        headers: GUEST,
        payload: { productId: 'prod-lamp', quantity: 1 },
      }),
      app.inject({
        method: 'POST',
        url: `/v1/carts/${cart.id}/items`,
        headers: GUEST,
        payload: { productId: 'prod-notebook', quantity: 3 },
      }),
    ]);

    const current = await app.inject({
      method: 'GET',
      url: `/v1/carts/${cart.id}`,
      headers: GUEST,
    });
    const body = current.json();

    const subtotal = body.items.reduce(
      (acc: number, item: { unitPriceCents: number; quantity: number }) =>
        acc + item.unitPriceCents * item.quantity,
      0,
    );
    expect(body.totals.subtotalCents).toBe(subtotal);
    expect(body.items).toHaveLength(3);
  });
});
