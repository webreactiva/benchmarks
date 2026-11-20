// Repositorio sobre Redis: permite ejecutar N instancias del servicio sin estado
// detrás de un balanceador, compartiendo los carritos.
//
// - Cada carrito es un HASH `cart:{id}` con campos v (versión) y d (JSON).
//   Las llaves `{id}` son "hash tags": en Redis Cluster todo lo de un carrito
//   cae en el mismo slot, y los carritos se reparten uniformemente entre nodos.
// - La escritura es un compare-and-set atómico en Lua (concurrencia optimista):
//   no hay locks distribuidos ni bloqueos entre peticiones.
// - El TTL se renueva en cada escritura: los carritos abandonados caducan solos.
//
// Requiere un cliente compatible con ioredis:
//   client.hget(key, field), client.del(key),
//   client.eval(script, numKeys, ...keys, ...args)
//
//   import Redis from 'ioredis';
//   const repo = new RedisCartRepository({ client: new Redis(process.env.REDIS_URL) });

import { ConcurrencyError } from '../domain/errors.js';

const CAS_SCRIPT = `
local current = tonumber(redis.call('HGET', KEYS[1], 'v') or '0')
if current ~= tonumber(ARGV[1]) then
  return current
end
redis.call('HSET', KEYS[1], 'v', ARGV[2], 'd', ARGV[3])
redis.call('PEXPIRE', KEYS[1], ARGV[4])
return -1
`;

export class RedisCartRepository {
  constructor({ client, ttlMs = 30 * 24 * 3600 * 1000, prefix = 'cart:' }) {
    if (!client) throw new Error('RedisCartRepository necesita un cliente Redis');
    this.client = client;
    this.ttlMs = ttlMs;
    this.prefix = prefix;
  }

  key(id) {
    return `${this.prefix}{${id}}`;
  }

  async get(id) {
    const json = await this.client.hget(this.key(id), 'd');
    return json ? JSON.parse(json) : null;
  }

  async save(cart, expectedVersion) {
    const saved = { ...cart, version: expectedVersion + 1 };
    const result = await this.client.eval(
      CAS_SCRIPT,
      1,
      this.key(cart.id),
      String(expectedVersion),
      String(saved.version),
      JSON.stringify(saved),
      String(this.ttlMs),
    );
    if (Number(result) !== -1) throw new ConcurrencyError(cart.id, expectedVersion, Number(result));
    return saved;
  }

  async delete(id) {
    return (await this.client.del(this.key(id))) > 0;
  }
}
