import type { CartSnapshot } from "../domain/cart.ts";

/**
 * Persistence Port for Cart aggregates.
 * Implementations (Redis, PostgreSQL, DynamoDB, File, In-Memory) MUST enforce
 * optimistic concurrency control using `expectedVersion` (0 for new carts).
 */
export interface CartRepository {
  findById(cartId: string): Promise<CartSnapshot | null>;
  findActiveByOwner(ownerId: string): Promise<CartSnapshot | null>;
  /**
   * Persists a cart snapshot only if the stored version equals `expectedVersion`.
   * Pass `expectedVersion = 0` when creating a new cart.
   * Throws `ConcurrencyConflictError` if another writer mutated the cart concurrently.
   */
  save(snapshot: CartSnapshot, expectedVersion: number): Promise<void>;
  delete(cartId: string): Promise<boolean>;
  /**
   * Finds and marks/removes expired carts so storage does not grow unboundedly.
   * Returns the expired cart snapshots (or IDs) that were purged/marked.
   */
  purgeExpired(now: Date): Promise<CartSnapshot[]>;
}
