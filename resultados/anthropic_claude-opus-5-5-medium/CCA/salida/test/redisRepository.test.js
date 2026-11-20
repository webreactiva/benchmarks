// Verifica el adaptador Redis contra un cliente simulado que reproduce la
// semántica del script CAS. No sustituye una prueba contra un Redis real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RedisCartRepository } from '../src/infrastructure/redisCartRepository.js';
import { ConcurrencyError } from '../src/domain/errors.js';

function fakeRedis() {
  const h = new Map();
  return {
    h,
    async hget(key, field) { return h.get(key)?.[field] ?? null; },
    async del(key) { return h.delete(key) ? 1 : 0; },
    async eval(_script, _n, key, expected, next, data, ttl) {
      const cur = Number(h.get(key)?.v ?? 0);
      if (cur !== Number(expected)) return cur;
      h.set(key, { v: next, d: data, ttl: Number(ttl) });
      return -1;
    },
  };
}

test('RedisCartRepository: CAS, hash tags, TTL y borrado', async () => {
  const client = fakeRedis();
  const repo = new RedisCartRepository({ client, ttlMs: 1000 });
  const saved = await repo.save({ id: 'abc', items: [] }, 0);
  assert.equal(saved.version, 1);
  assert.ok(client.h.has('cart:{abc}'));
  assert.equal(client.h.get('cart:{abc}').ttl, 1000);
  assert.deepEqual(await repo.get('abc'), saved);
  await assert.rejects(repo.save({ id: 'abc', items: [] }, 0), ConcurrencyError);
  assert.equal(await repo.delete('abc'), true);
  assert.equal(await repo.get('abc'), null);
});
