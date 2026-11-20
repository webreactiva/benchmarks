import type { CartSnapshot } from "../domain/cart.ts";
import { ConcurrencyConflictError } from "../domain/errors.ts";
import type { CartRepository } from "../ports/cart-repository.ts";

function cloneSnapshot(snapshot: CartSnapshot): CartSnapshot {
  return structuredClone(snapshot);
}

/**
 * In-memory CartRepository with strict Optimistic Concurrency Control (OCC).
 * Suitable for unit/integration tests and single-instance development.
 * Replace with a Redis/PostgreSQL adapter implementing the exact same contract for multi-node production.
 */
export class InMemoryCartRepository implements CartRepository {
  private readonly carts = new Map<string, CartSnapshot>();

  async findById(cartId: string): Promise<CartSnapshot | null> {
    const found = this.carts.get(cartId);
    return found ? cloneSnapshot(found) : null;
  }

  async findActiveByOwner(ownerId: string): Promise<CartSnapshot | null> {
    let latest: CartSnapshot | null = null;
    for (const cart of this.carts.values()) {
      if (cart.ownerId === ownerId && cart.status === "ACTIVE") {
        if (!latest || cart.updatedAt > latest.updatedAt) {
          latest = cart;
        }
      }
    }
    return latest ? cloneSnapshot(latest) : null;
  }

  async save(snapshot: CartSnapshot, expectedVersion: number): Promise<void> {
    const existing = this.carts.get(snapshot.id);
    const actualVersion = existing ? existing.version : 0;

    if (actualVersion !== expectedVersion) {
      throw new ConcurrencyConflictError(snapshot.id, expectedVersion, actualVersion);
    }

    this.carts.set(snapshot.id, cloneSnapshot(snapshot));
  }

  async delete(cartId: string): Promise<boolean> {
    return this.carts.delete(cartId);
  }

  async purgeExpired(now: Date): Promise<CartSnapshot[]> {
    const expired: CartSnapshot[] = [];
    const nowMs = now.getTime();

    for (const [id, snapshot] of this.carts.entries()) {
      if (snapshot.status === "ACTIVE" && new Date(snapshot.expiresAt).getTime() <= nowMs) {
        const updated: CartSnapshot = {
          ...cloneSnapshot(snapshot),
          status: "EXPIRED",
          version: snapshot.version + 1,
          updatedAt: now.toISOString(),
        };
        this.carts.set(id, updated);
        expired.push(cloneSnapshot(updated));
      }
    }

    return expired;
  }

  count(): number {
    return this.carts.size;
  }
}
