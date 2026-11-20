import type { Cart } from '../domain/cart.ts';
import type { DomainEvent } from '../domain/events.ts';
import type { CurrencyCode } from '../domain/money.ts';

export interface CatalogProduct {
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly unitPriceMinor: number;
  readonly currency: CurrencyCode;
  readonly availableStock: number;
  readonly active: boolean;
  readonly imageUrl?: string;
}

export interface StockReservationLine {
  readonly sku: string;
  readonly quantity: number;
}

export interface StockReservation {
  readonly reservationId: string;
  readonly lines: ReadonlyArray<StockReservationLine>;
  readonly expiresAt: string;
}

export interface CartRepository {
  findById(cartId: string): Promise<Cart | null>;
  findActiveByUserId(userId: string): Promise<Cart | null>;
  findActiveBySessionId(sessionId: string): Promise<Cart | null>;
  /**
   * Persiste el agregado aplicando Control de Concurrencia Optimista (Compare-And-Swap).
   * - expectedVersion === 0 indica inserción de un nuevo carrito.
   * - expectedVersion > 0 exige que la versión persistida coincida exactamente.
   */
  save(cart: Cart, expectedVersion: number): Promise<void>;
  /**
   * Persiste atómicamente dos carritos (ej. fusión carrito invitado -> carrito usuario).
   */
  savePairAtomic(
    targetCart: Cart,
    targetExpectedVersion: number,
    sourceCart: Cart,
    sourceExpectedVersion: number,
  ): Promise<void>;
  purgeExpired(now?: Date): Promise<number>;
}

export interface CatalogInventoryPort {
  listProducts(): Promise<ReadonlyArray<CatalogProduct>>;
  getProduct(sku: string): Promise<CatalogProduct | null>;
  getProducts(skus: ReadonlyArray<string>): Promise<Map<string, CatalogProduct>>;
  reserveStock(
    reservationId: string,
    lines: ReadonlyArray<StockReservationLine>,
    ttlMs?: number,
  ): Promise<StockReservation>;
  commitReservation(reservationId: string): Promise<void>;
  releaseReservation(reservationId: string): Promise<void>;
}

export interface IdempotencyRecord<T = unknown> {
  readonly result: T;
  readonly replayed: boolean;
}

export interface IdempotencyPort {
  execute<T>(
    key: string,
    fingerprint: string,
    operation: () => Promise<T>,
    ttlMs?: number,
  ): Promise<IdempotencyRecord<T>>;
}

export type EventSubscriber = (event: DomainEvent) => void | Promise<void>;

export interface EventBusPort {
  publish(events: ReadonlyArray<DomainEvent>): Promise<void>;
  subscribe(eventType: DomainEvent['type'] | '*', subscriber: EventSubscriber): () => void;
}
