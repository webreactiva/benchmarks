import type { Cart } from "../domain/cart.js";
import type { Coupon, Product } from "../domain/catalog.js";
import type { DomainEvent } from "../domain/events.js";

export interface CartRepository {
  /** Inserts a new cart. Must fail with VersionConflictError if the id already exists. */
  insert(cart: Cart): Promise<void>;
  /**
   * Persists a cart using optimistic concurrency: succeeds only when the stored
   * version equals `expectedVersion`; otherwise throws VersionConflictError.
   */
  save(cart: Cart, expectedVersion: number): Promise<void>;
  /** Returns the cart, or null when it does not exist or has expired. */
  getById(cartId: string): Promise<Cart | null>;
}

export interface ProductCatalog {
  getById(productId: string): Promise<Product | null>;
  list(): Promise<Product[]>;
  /** Atomically decrements stock. Throws InsufficientStockError when not possible. */
  decrementStock(productId: string, quantity: number): Promise<void>;
}

export interface CouponRepository {
  getByCode(code: string): Promise<Coupon | null>;
}

export interface EventBus {
  publish(events: DomainEvent[]): Promise<void>;
}
