import type { CartRepository, Logger } from '@cart/core';
import { CartConflictError, CartNotFoundError, type Cart } from '@cart/core';
import { CREATE_CART_SCRIPT, SAVE_CART_SCRIPT } from './scripts.js';
import type { RedisClient } from './connection.js';

export interface RedisCartRepositoryOptions {
  readonly keyPrefix: string;
  readonly ttlSeconds: number;
  readonly logger: Logger;
}

/**
 * Redis backed cart repository.
 *
 * Key layout (the `{...}` is the Redis Cluster hash tag, so every operation on
 * a cart stays inside the shard that owns it):
 *
 *   cart:{<cartId>}          -> JSON document of the cart
 *   cart:index:{<customerId>} -> set of cart ids owned by the customer
 */
export class RedisCartRepository implements CartRepository {
  private readonly prefix: string;
  private readonly ttlSeconds: number;
  private readonly logger: Logger;

  constructor(
    private readonly redis: RedisClient,
    options: RedisCartRepositoryOptions,
  ) {
    this.prefix = options.keyPrefix;
    this.ttlSeconds = options.ttlSeconds;
    this.logger = options.logger;
  }

  private cartKey(cartId: string): string {
    return `${this.prefix}{${cartId}}`;
  }

  private indexKey(customerId: string): string {
    return `${this.prefix}index:{${customerId}}`;
  }

  async findById(cartId: string): Promise<Cart | null> {
    const raw = await this.redis.get(this.cartKey(cartId));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as Cart;
    } catch (error) {
      this.logger.error('corrupted cart payload in redis', { cartId, error: String(error) });
      throw new CartNotFoundError(cartId);
    }
  }

  async create(cart: Cart): Promise<Cart> {
    const result = (await this.redis.eval(CREATE_CART_SCRIPT, {
      keys: [this.cartKey(cart.id)],
      arguments: [JSON.stringify(cart), String(this.ttlSeconds)],
    })) as string[];

    if (result[0] === 'exists') {
      throw new CartConflictError(cart.id, 0, 0);
    }
    if (cart.customerId) {
      await this.redis.sAdd(this.indexKey(cart.customerId), cart.id);
      await this.redis.expire(this.indexKey(cart.customerId), this.ttlSeconds);
    }
    return cart;
  }

  async save(cart: Cart, expectedVersion: number): Promise<Cart> {
    const nextVersion = expectedVersion + 1;
    const payload: Cart = { ...cart, version: nextVersion };

    const result = (await this.redis.eval(SAVE_CART_SCRIPT, {
      keys: [this.cartKey(cart.id)],
      arguments: [String(expectedVersion), JSON.stringify(payload), String(this.ttlSeconds)],
    })) as string[];

    const status = result[0];
    if (status === 'not_found') throw new CartNotFoundError(cart.id);
    if (status === 'corrupt') {
      this.logger.error('corrupted cart payload in redis', { cartId: cart.id });
      throw new CartNotFoundError(cart.id);
    }
    if (status === 'conflict') {
      throw new CartConflictError(cart.id, expectedVersion, Number(result[1] ?? -1));
    }
    if (payload.customerId) {
      // Keeps the customer index in sync when a guest cart is claimed.
      await this.redis.sAdd(this.indexKey(payload.customerId), payload.id);
      await this.redis.expire(this.indexKey(payload.customerId), this.ttlSeconds);
    }
    return payload;
  }

  async findActiveByCustomer(customerId: string): Promise<Cart | null> {
    const ids = await this.redis.sMembers(this.indexKey(customerId));
    if (ids.length === 0) return null;

    const carts = await Promise.all(ids.map((id) => this.findById(id)));
    const active = carts
      .filter((cart): cart is Cart => cart !== null && cart.status === 'active')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return active[0] ?? null;
  }

  async listByCustomer(customerId: string, limit = 20): Promise<Cart[]> {
    const ids = await this.redis.sMembers(this.indexKey(customerId));
    if (ids.length === 0) return [];

    const carts = await Promise.all(ids.map((id) => this.findById(id)));
    return carts
      .filter((cart): cart is Cart => cart !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  async delete(cartId: string): Promise<void> {
    const cart = await this.findById(cartId);
    await this.redis.del(this.cartKey(cartId));
    if (cart?.customerId) {
      await this.redis.sRem(this.indexKey(cart.customerId), cartId);
    }
  }
}
