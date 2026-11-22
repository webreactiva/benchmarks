import { quantityExceeded, tooManyLines } from '../errors.js';

/**
 * Almacén en memoria para desarrollo y tests. Mismo contrato que RedisCartStore.
 * No sirve para producción: el estado vive en un único proceso y las entradas
 * caducadas solo se liberan cuando se vuelve a acceder a ellas.
 */
export class MemoryCartStore {
  constructor(limits, now = () => Date.now()) {
    this.limits = limits;
    this.now = now;
    this.carts = new Map(); // cartId -> { items: Map<sku, qty>, expiresAt }
    this.idempotency = new Map(); // `${cartId}:${key}` -> expiresAt
  }

  #live(cartId) {
    const cart = this.carts.get(cartId);
    if (cart && cart.expiresAt <= this.now()) {
      this.carts.delete(cartId);
      return undefined;
    }
    return cart;
  }

  #touch(cartId, cart) {
    cart.expiresAt = this.now() + this.limits.cartTtlSeconds * 1000;
    this.carts.set(cartId, cart);
  }

  async getItems(cartId) {
    return Object.fromEntries(this.#live(cartId)?.items ?? []);
  }

  async addItem(cartId, sku, quantity, { idempotencyKey } = {}) {
    const idemKey = idempotencyKey && `${cartId}:${idempotencyKey}`;
    if (idemKey && this.idempotency.get(idemKey) > this.now()) return;

    const cart = this.#live(cartId) ?? { items: new Map(), expiresAt: 0 };
    const current = cart.items.get(sku);
    if (current === undefined && cart.items.size >= this.limits.maxLines) {
      throw tooManyLines(this.limits.maxLines);
    }
    const next = (current ?? 0) + quantity;
    if (next > this.limits.maxQuantityPerLine) throw quantityExceeded(this.limits.maxQuantityPerLine);

    cart.items.set(sku, next);
    this.#touch(cartId, cart);
    if (idemKey) this.idempotency.set(idemKey, this.now() + this.limits.idempotencyTtlSeconds * 1000);
  }

  async setItem(cartId, sku, quantity) {
    const cart = this.#live(cartId) ?? { items: new Map(), expiresAt: 0 };
    if (!cart.items.has(sku) && cart.items.size >= this.limits.maxLines) {
      throw tooManyLines(this.limits.maxLines);
    }
    cart.items.set(sku, quantity);
    this.#touch(cartId, cart);
  }

  async removeItem(cartId, sku) {
    const cart = this.#live(cartId);
    if (!cart) return;
    cart.items.delete(sku);
    if (cart.items.size === 0) this.carts.delete(cartId);
  }

  async clear(cartId) {
    this.carts.delete(cartId);
  }

  async ping() {}

  async close() {}
}
