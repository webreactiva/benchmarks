import { quantityExceeded, tooManyLines } from '../errors.js';

/**
 * Almacén en Redis: un hash por carrito (campo = SKU, valor = cantidad).
 *
 * - Cada mutación es un único script Lua, atómico en Redis: no hay ciclo
 *   leer-modificar-escribir en la aplicación ni bloqueos distribuidos, así que
 *   cualquier número de réplicas del servicio puede escribir en el mismo carrito.
 * - El coste de cada operación es O(1) respecto al tamaño del carrito
 *   (la lectura es O(líneas), acotado por maxLines).
 * - Las claves comparten la etiqueta {cartId}, por lo que todas las claves de un
 *   carrito caen en el mismo slot y el esquema funciona en Redis Cluster.
 * - Los carritos abandonados caducan solos (TTL renovado en cada escritura).
 */

const ADD_ITEM = `
local idem = KEYS[2]
if idem and redis.call('EXISTS', idem) == 1 then return 'OK' end
local sku, qty = ARGV[1], tonumber(ARGV[2])
local maxLines, maxQty = tonumber(ARGV[3]), tonumber(ARGV[4])
local current = tonumber(redis.call('HGET', KEYS[1], sku))
if not current and redis.call('HLEN', KEYS[1]) >= maxLines then return 'LINES' end
local total = (current or 0) + qty
if total > maxQty then return 'QTY' end
redis.call('HSET', KEYS[1], sku, total)
redis.call('EXPIRE', KEYS[1], ARGV[5])
if idem then redis.call('SET', idem, 1, 'EX', ARGV[6]) end
return 'OK'
`;

const SET_ITEM = `
local sku = ARGV[1]
if redis.call('HEXISTS', KEYS[1], sku) == 0 and redis.call('HLEN', KEYS[1]) >= tonumber(ARGV[3]) then
  return 'LINES'
end
redis.call('HSET', KEYS[1], sku, ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return 'OK'
`;

export class RedisCartStore {
  /** @param {import('ioredis').Redis | import('ioredis').Cluster} redis */
  constructor(redis, limits) {
    this.redis = redis;
    this.limits = limits;
    redis.defineCommand('cartAddItem', { lua: ADD_ITEM });
    redis.defineCommand('cartSetItem', { numberOfKeys: 1, lua: SET_ITEM });
  }

  #itemsKey(cartId) {
    return `cart:{${cartId}}:items`;
  }

  async getItems(cartId) {
    const raw = await this.redis.hgetall(this.#itemsKey(cartId));
    const items = {};
    for (const [sku, qty] of Object.entries(raw)) items[sku] = Number(qty);
    return items;
  }

  async addItem(cartId, sku, quantity, { idempotencyKey } = {}) {
    const keys = [this.#itemsKey(cartId)];
    if (idempotencyKey) keys.push(`cart:{${cartId}}:idem:${idempotencyKey}`);
    const { maxLines, maxQuantityPerLine, cartTtlSeconds, idempotencyTtlSeconds } = this.limits;
    const result = await this.redis.cartAddItem(
      keys.length, ...keys,
      sku, quantity, maxLines, maxQuantityPerLine, cartTtlSeconds, idempotencyTtlSeconds,
    );
    this.#check(result);
  }

  async setItem(cartId, sku, quantity) {
    const result = await this.redis.cartSetItem(
      this.#itemsKey(cartId), sku, quantity, this.limits.maxLines, this.limits.cartTtlSeconds,
    );
    this.#check(result);
  }

  async removeItem(cartId, sku) {
    await this.redis.hdel(this.#itemsKey(cartId), sku);
  }

  async clear(cartId) {
    await this.redis.del(this.#itemsKey(cartId));
  }

  async ping() {
    await this.redis.ping();
  }

  async close() {
    await this.redis.quit();
  }

  #check(result) {
    if (result === 'LINES') throw tooManyLines(this.limits.maxLines);
    if (result === 'QTY') throw quantityExceeded(this.limits.maxQuantityPerLine);
  }
}
