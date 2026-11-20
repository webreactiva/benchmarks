import type { Cart } from '../domain/cart.js';
import type { CouponDefinition, Promotion } from '../domain/coupon.js';
import type { DomainEvent } from '../domain/events.js';
import type { CatalogProduct, CatalogQuery } from '../domain/product.js';

export interface Clock {
  now(): Date;
  nowIso(): string;
}

export interface IdGenerator {
  next(prefix?: string): string;
}

/**
 * Cart persistence. Implementations MUST provide compare-and-set semantics on
 * `save` (optimistic locking) so that concurrent writers never silently
 * overwrite each other.
 */
export interface CartRepository {
  findById(cartId: string): Promise<Cart | null>;
  create(cart: Cart): Promise<Cart>;
  /**
   * Writes the cart only if the stored version still equals `expectedVersion`.
   * Throws `CartConflictError` otherwise and returns the cart with its new version.
   */
  save(cart: Cart, expectedVersion: number): Promise<Cart>;
  /** Returns the (single) active cart of a customer, if any. */
  findActiveByCustomer(customerId: string): Promise<Cart | null>;
  listByCustomer(customerId: string, limit?: number): Promise<Cart[]>;
  delete(cartId: string): Promise<void>;
}

export interface ProductCatalog {
  getProduct(productId: string): Promise<CatalogProduct | null>;
  /** Batch lookup — the cart never issues one request per line. */
  getProducts(productIds: readonly string[]): Promise<Map<string, CatalogProduct>>;
  list(query?: CatalogQuery): Promise<CatalogProduct[]>;
}

export interface PricingRulesProvider {
  getPromotions(now: Date): Promise<Promotion[]>;
  getCoupon(code: string): Promise<CouponDefinition | null>;
}

export interface StockRequest {
  readonly productId: string;
  readonly quantity: number;
}

export interface StockReservation {
  readonly reservationId: string;
  readonly items: readonly StockRequest[];
}

export interface StockManager {
  /** Reserves every item atomically: either all succeed or none do. */
  reserve(items: readonly StockRequest[]): Promise<StockReservation>;
  release(reservationId: string): Promise<void>;
  available(productId: string): Promise<number>;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: readonly DomainEvent[]): Promise<void>;
}

export interface EventSubscriber {
  subscribe(handler: (event: DomainEvent) => void): Promise<() => void>;
}

export interface IdempotencyRecord {
  readonly key: string;
  readonly requestHash: string;
  readonly statusCode: number;
  readonly body: unknown;
  readonly createdAt: string;
}

export type IdempotencyClaim = 'claimed' | 'replay' | 'conflict';

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | null>;
  put(record: IdempotencyRecord, ttlSeconds: number): Promise<void>;
  /**
   * Atomically claims the key.
   * `claimed` -> the caller must execute the operation.
   * `replay`  -> the operation already ran, return the stored response.
   * `conflict`-> the key was used with a different payload.
   */
  claim(key: string, requestHash: string, ttlSeconds: number): Promise<IdempotencyClaim>;
}

export interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => noopLogger,
};
