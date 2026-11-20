import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { EventConsumer } from '../../src/infrastructure/event-consumer.js';
import { RedisEventPublisher } from '../../src/infrastructure/redis-event-publisher.js';

let harness: TestApp;

describe('consumidor de eventos (grupo de consumidores)', () => {
  beforeAll(async () => {
    harness = await createTestApp();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('crea el grupo en la clave correcta y consume los eventos emitidos', async () => {
    const group = `grupo-${randomUUID().slice(0, 8)}`;
    const consumer = new EventConsumer(harness.redis, {
      stream: 'events:cart',
      group,
      consumer: 'test-consumer',
      batchSize: 10,
      blockMs: 200,
      minIdleMs: 30_000,
      keyPrefix: harness.config.redis.keyPrefix,
    });

    const created = await consumer.ensureGroup();
    expect(created).toBe(true);

    // el grupo debe existir sobre la clave física (con prefijo)
    const groups = await consumer.groups();
    expect(groups).toContain(group);

    // se emite un evento desde la API (outbox transaccional)
    const cart = await harness.app.inject({
      method: 'POST',
      url: '/v1/carts',
      headers: { 'x-session-id': 'sesion-consumer' },
      payload: {},
    });
    const cartId = cart.json().id as string;

    const publisher = new RedisEventPublisher(harness.redis, 'events:cart');
    await publisher.publish({
      id: randomUUID(),
      type: 'cart.viewed',
      occurredAt: new Date().toISOString(),
      cartId,
      version: 1,
      actorId: null,
      payload: { origen: 'test' },
    });

    const events = await consumer.readBatch();
    expect(events.length).toBeGreaterThan(0);

    const viewed = events.find((e) => e.type === 'cart.viewed');
    expect(viewed).toBeDefined();
    expect(viewed?.cartId).toBe(cartId);
    expect(viewed?.data).toMatchObject({ origen: 'test' });

    await consumer.ack(viewed!.id);

    // el evento de creación (outbox) también debe estar en el stream
    const created2 = events.find((e) => e.type === 'cart.created');
    expect(created2).toBeDefined();
    expect(created2?.version).toBe('1');
  });

  it('reclama mensajes pendientes de un consumidor muerto', async () => {
    const group = `grupo-${randomUUID().slice(0, 8)}`;
    const options = {
      stream: 'events:cart',
      group,
      batchSize: 10,
      blockMs: 200,
      minIdleMs: 10,
      keyPrefix: harness.config.redis.keyPrefix,
    };

    const dead = new EventConsumer(harness.redis, { ...options, consumer: 'muere' });
    await dead.ensureGroup();

    const publisher = new RedisEventPublisher(harness.redis, 'events:cart');
    await publisher.publish({
      id: randomUUID(),
      type: 'cart.created',
      occurredAt: new Date().toISOString(),
      cartId: 'cart-pendiente',
      version: 3,
      actorId: null,
      payload: {},
    });

    // el consumidor muerto no llega a confirmar el mensaje
    await dead.readBatch();

    const rescuer = new EventConsumer(harness.redis, { ...options, consumer: 'rescata' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const reclaimed = await rescuer.reclaimPending();
    expect(reclaimed.length).toBeGreaterThan(0);
    expect(reclaimed.map((e) => e.cartId)).toContain('cart-pendiente');
  });
});
