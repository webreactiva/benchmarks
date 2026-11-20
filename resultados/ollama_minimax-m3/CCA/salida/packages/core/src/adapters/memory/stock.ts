import { InsufficientStockError } from '../../domain/errors.js';
import type { StockManager, StockRequest, StockReservation } from '../../application/ports.js';
import type { IdGenerator } from '../../application/ports.js';

/**
 * In-memory stock manager. The reservation is atomic: the whole basket is
 * checked before any decrement happens, mirroring the Redis Lua script.
 */
export class InMemoryStockManager implements StockManager {
  private readonly stock = new Map<string, number>();
  private readonly reservations = new Map<string, StockRequest[]>();

  constructor(
    initialStock: Record<string, number> = {},
    private readonly ids?: IdGenerator,
  ) {
    for (const [productId, quantity] of Object.entries(initialStock)) {
      this.stock.set(productId, quantity);
    }
  }

  setStock(productId: string, quantity: number): void {
    this.stock.set(productId, quantity);
  }

  async reserve(items: readonly StockRequest[]): Promise<StockReservation> {
    for (const item of items) {
      const available = this.stock.get(item.productId) ?? 0;
      if (available < item.quantity) {
        throw new InsufficientStockError(item.productId, item.quantity, available);
      }
    }
    for (const item of items) {
      this.stock.set(item.productId, (this.stock.get(item.productId) ?? 0) - item.quantity);
    }
    const reservationId = this.ids?.next('resv') ?? `resv_${Date.now().toString(36)}`;
    this.reservations.set(reservationId, [...items]);
    return { reservationId, items: [...items] };
  }

  async release(reservationId: string): Promise<void> {
    const items = this.reservations.get(reservationId);
    if (!items) return;
    for (const item of items) {
      this.stock.set(item.productId, (this.stock.get(item.productId) ?? 0) + item.quantity);
    }
    this.reservations.delete(reservationId);
  }

  async available(productId: string): Promise<number> {
    return this.stock.get(productId) ?? 0;
  }
}
