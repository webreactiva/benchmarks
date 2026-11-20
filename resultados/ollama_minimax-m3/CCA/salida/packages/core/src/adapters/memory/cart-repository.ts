import { CartConflictError, CartNotFoundError } from '../../domain/errors.js';
import type { Cart } from '../../domain/cart.js';
import type { CartRepository } from '../../application/ports.js';

/**
 * Reference in-memory implementation of the cart repository.
 *
 * It behaves exactly like the Redis adapter (compare & set on `version`) which
 * makes it useful both as a single node fallback and as a test double.
 */
export class InMemoryCartRepository implements CartRepository {
  private readonly carts = new Map<string, Cart>();

  constructor(initialCarts: readonly Cart[] = []) {
    for (const cart of initialCarts) {
      this.carts.set(cart.id, cart);
    }
  }

  async findById(cartId: string): Promise<Cart | null> {
    return this.carts.get(cartId) ?? null;
  }

  async create(cart: Cart): Promise<Cart> {
    if (this.carts.has(cart.id)) {
      throw new CartConflictError(cart.id, 0, this.carts.get(cart.id)?.version ?? 0);
    }
    this.carts.set(cart.id, cart);
    return cart;
  }

  async save(cart: Cart, expectedVersion: number): Promise<Cart> {
    const current = this.carts.get(cart.id);
    if (!current) throw new CartNotFoundError(cart.id);
    if (current.version !== expectedVersion) {
      throw new CartConflictError(cart.id, expectedVersion, current.version);
    }
    const next: Cart = { ...cart, version: current.version + 1 };
    this.carts.set(cart.id, next);
    return next;
  }

  async findActiveByCustomer(customerId: string): Promise<Cart | null> {
    for (const cart of this.carts.values()) {
      if (cart.customerId === customerId && cart.status === 'active') return cart;
    }
    return null;
  }

  async listByCustomer(customerId: string, limit = 20): Promise<Cart[]> {
    const result: Cart[] = [];
    for (const cart of this.carts.values()) {
      if (cart.customerId === customerId) result.push(cart);
    }
    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
  }

  async delete(cartId: string): Promise<void> {
    this.carts.delete(cartId);
  }

  /** Test helper: number of stored carts. */
  size(): number {
    return this.carts.size;
  }
}
