import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/test-app.js';

let harness: TestApp;

describe('outbox transaccional', () => {
  beforeAll(async () => {
    harness = await createTestApp();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('escribe el evento en el mismo script que la mutación', async () => {
    const streamKey = 'events:cart';

    const created = await harness.app.inject({
      method: 'POST',
      url: '/v1/carts',
      headers: { 'x-session-id': 'sesion-outbox' },
      payload: {},
    });
    const cartId = created.json().id as string;

    await harness.app.inject({
      method: 'POST',
      url: `/v1/carts/${cartId}/items`,
      headers: { 'x-session-id': 'sesion-outbox' },
      payload: { productId: 'prod-tea', quantity: 1 },
    });

    const entries = await harness.redis.xrange(streamKey, '-', '+');
    const events = entries.map((entry) => {
      const fields = entry[1] as string[];
      const map: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) map[fields[i] as string] = fields[i + 1] as string;
      return map;
    });

    const createdEvent = events.find((e) => e.type === 'cart.created');
    const addedEvent = events.find((e) => e.type === 'cart.item_added');

    expect(createdEvent).toBeDefined();
    expect(createdEvent?.cartId).toBe(cartId);
    expect(createdEvent?.version).toBe('1');

    expect(addedEvent).toBeDefined();
    expect(addedEvent?.cartId).toBe(cartId);
    expect(addedEvent?.version).toBe('2');
    expect(JSON.parse(addedEvent?.data ?? '{}')).toMatchObject({ productId: 'prod-tea' });
  });

  it('no emite eventos cuando la mutación es rechazada', async () => {
    const streamKey = 'events:cart';
    const before = await harness.redis.xlen(streamKey);

    const created = await harness.app.inject({
      method: 'POST',
      url: '/v1/carts',
      headers: { 'x-session-id': 'sesion-outbox-2' },
      payload: {},
    });
    const cartId = created.json().id as string;

    // cantidad no válida: el script aborta y no escribe evento
    await harness.app.inject({
      method: 'POST',
      url: `/v1/carts/${cartId}/items`,
      headers: { 'x-session-id': 'sesion-outbox-2' },
      payload: { productId: 'prod-tea', quantity: 0 },
    });

    const after = await harness.redis.xlen(streamKey);
    expect(after).toBe(before + 1); // solo el evento de creación
  });
});
