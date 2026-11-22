// Contrato común de los almacenes. La parte de Redis solo se ejecuta si se
// define REDIS_URL (p. ej. REDIS_URL=redis://localhost:6379 npm test).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, describe, test } from 'node:test';
import Redis from 'ioredis';
import { MemoryCartStore } from '../src/stores/memoryStore.js';
import { RedisCartStore } from '../src/stores/redisStore.js';

const limits = { maxLines: 3, maxQuantityPerLine: 500, cartTtlSeconds: 60, idempotencyTtlSeconds: 60 };

function contract(name, makeStore, options = {}) {
  describe(name, options, () => {
    const store = makeStore();
    after(() => store.close());
    const newId = () => randomUUID();

    test('un carrito inexistente está vacío', async () => {
      assert.deepEqual(await store.getItems(newId()), {});
    });

    test('añadir acumula cantidades', async () => {
      const id = newId();
      await store.addItem(id, 'A', 2);
      await store.addItem(id, 'A', 3);
      await store.addItem(id, 'B', 1);
      assert.deepEqual(await store.getItems(id), { A: 5, B: 1 });
    });

    test('las sumas concurrentes no pierden actualizaciones', async () => {
      const id = newId();
      await Promise.all(Array.from({ length: 200 }, () => store.addItem(id, 'A', 1)));
      assert.deepEqual(await store.getItems(id), { A: 200 });
    });

    test('la misma clave de idempotencia solo se aplica una vez', async () => {
      const id = newId();
      await Promise.all(
        Array.from({ length: 10 }, () => store.addItem(id, 'A', 2, { idempotencyKey: 'k1' })),
      );
      await store.addItem(id, 'A', 2, { idempotencyKey: 'k2' });
      assert.deepEqual(await store.getItems(id), { A: 4 });
    });

    test('una suma rechazada no consume la clave de idempotencia', async () => {
      const id = newId();
      await store.addItem(id, 'A', 499);
      await assert.rejects(store.addItem(id, 'A', 2, { idempotencyKey: 'k' }), { code: 'QUANTITY_LIMIT' });
      await store.setItem(id, 'A', 1);
      await store.addItem(id, 'A', 2, { idempotencyKey: 'k' });
      assert.deepEqual(await store.getItems(id), { A: 3 });
    });

    test('fijar, eliminar y vaciar', async () => {
      const id = newId();
      await store.addItem(id, 'A', 5);
      await store.setItem(id, 'A', 2);
      await store.setItem(id, 'B', 7);
      assert.deepEqual(await store.getItems(id), { A: 2, B: 7 });
      await store.removeItem(id, 'A');
      await store.removeItem(id, 'no-existe');
      assert.deepEqual(await store.getItems(id), { B: 7 });
      await store.clear(id);
      assert.deepEqual(await store.getItems(id), {});
    });

    test('respeta el máximo de líneas y de unidades por línea', async () => {
      const id = newId();
      await store.addItem(id, 'A', 1);
      await store.addItem(id, 'B', 1);
      await store.setItem(id, 'C', 1);
      await assert.rejects(store.addItem(id, 'D', 1), { code: 'CART_LINE_LIMIT' });
      await assert.rejects(store.setItem(id, 'D', 1), { code: 'CART_LINE_LIMIT' });
      await assert.rejects(store.addItem(id, 'A', 500), { code: 'QUANTITY_LIMIT' });
      await store.addItem(id, 'A', 499); // una línea existente sí admite más unidades
      assert.deepEqual(await store.getItems(id), { A: 500, B: 1, C: 1 });
    });
  });
}

contract('MemoryCartStore', () => new MemoryCartStore(limits));

contract('RedisCartStore', () => new RedisCartStore(new Redis(process.env.REDIS_URL), limits), {
  skip: !process.env.REDIS_URL && 'REDIS_URL no definida',
});

test('MemoryCartStore: el carrito caduca tras el TTL', async () => {
  let now = 0;
  const store = new MemoryCartStore(limits, () => now);
  await store.addItem('c', 'A', 1);
  now = 59_000;
  assert.deepEqual(await store.getItems('c'), { A: 1 });
  now = 60_000;
  assert.deepEqual(await store.getItems('c'), {});
});

test('RedisCartStore: las escrituras fijan el TTL', { skip: !process.env.REDIS_URL }, async () => {
  const redis = new Redis(process.env.REDIS_URL);
  const store = new RedisCartStore(redis, limits);
  const id = randomUUID();
  await store.addItem(id, 'A', 1, { idempotencyKey: 'k' });
  const ttl = await redis.ttl(`cart:{${id}}:items`);
  const idemTtl = await redis.ttl(`cart:{${id}}:idem:k`);
  assert.ok(ttl > 0 && ttl <= 60);
  assert.ok(idemTtl > 0 && idemTtl <= 60);
  await store.close();
});
