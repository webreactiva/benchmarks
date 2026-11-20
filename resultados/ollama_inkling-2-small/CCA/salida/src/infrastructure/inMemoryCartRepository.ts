import { Cart } from "../domain/cart.js";
import { VersionConflictError } from "../domain/errors.js";
import type { CartRepository } from "../application/ports.js";

/**
 * Process-local cart store. Persists deep copies so callers cannot mutate
 * stored state by reference. Suitable for a single instance; swap for a
 * Redis/Postgres implementation of CartRepository to scale horizontally.
 */
export class InMemoryCartRepository implements CartRepository {
  private readonly store = new Map<string, ReturnType<Cart["toProps"]>>();

  async insert(cart: Cart): Promise<void> {
    if (this.store.has(cart.id)) {
      throw new VersionConflictError(cart.id, -1, cart.version);
    }
    this.store.set(cart.id, cart.toProps());
  }

  async save(cart: Cart, expectedVersion: number): Promise<void> {
    const stored = this.fresh(cart.id);
    const currentVersion = stored?.version ?? 0;
    if (currentVersion !== expectedVersion) {
      throw new VersionConflictError(cart.id, expectedVersion, currentVersion);
    }
    this.store.set(cart.id, cart.toProps());
  }

  async getById(cartId: string): Promise<Cart | null> {
    const props = this.fresh(cartId);
    return props ? Cart.rehydrate(props) : null;
  }

  /** Returns props if present and not expired; otherwise removes and returns null. */
  private fresh(cartId: string): ReturnType<Cart["toProps"]> | null {
    const props = this.store.get(cartId);
    if (!props) return null;
    if (props.expiresAt !== null && new Date(props.expiresAt).getTime() <= Date.now()) {
      this.store.delete(cartId);
      return null;
    }
    return structuredClone(props);
  }
}
