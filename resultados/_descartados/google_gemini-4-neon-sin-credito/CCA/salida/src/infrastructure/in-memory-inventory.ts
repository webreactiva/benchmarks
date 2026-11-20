import { randomUUID } from "node:crypto";
import { InsufficientStockError } from "../domain/errors.ts";
import type {
  InventoryProvider,
  StockItemRequest,
  StockReservation,
} from "../ports/inventory-provider.ts";

interface InternalReservation {
  readonly reservationId: string;
  readonly cartId: string;
  readonly items: readonly StockItemRequest[];
  readonly expiresAtMs: number;
  state: "RESERVED" | "COMMITTED" | "RELEASED";
}

/**
 * In-memory InventoryProvider with atomic all-or-nothing reservations
 * and automatic expiration of stale holds.
 */
export class InMemoryInventoryProvider implements InventoryProvider {
  private readonly totalStock = new Map<string, number>();
  private readonly reservations = new Map<string, InternalReservation>();
  private readonly defaultReservationTtlMs: number;

  constructor(
    initialStock: Record<string, number> = {},
    options: { defaultReservationTtlMs?: number } = {},
  ) {
    for (const [sku, qty] of Object.entries(initialStock)) {
      this.totalStock.set(sku, qty);
    }
    this.defaultReservationTtlMs = options.defaultReservationTtlMs ?? 15 * 60 * 1000;
  }

  setStock(sku: string, quantity: number): void {
    this.totalStock.set(sku, Math.max(0, quantity));
  }

  async getAvailableStock(sku: string): Promise<number> {
    this.cleanupExpiredReservations();
    const total = this.totalStock.get(sku) ?? 0;
    const reserved = this.getReservedCount(sku);
    return Math.max(0, total - reserved);
  }

  async getAvailableStockBatch(skus: readonly string[]): Promise<Map<string, number>> {
    this.cleanupExpiredReservations();
    const result = new Map<string, number>();
    for (const sku of skus) {
      const total = this.totalStock.get(sku) ?? 0;
      const reserved = this.getReservedCount(sku);
      result.set(sku, Math.max(0, total - reserved));
    }
    return result;
  }

  async reserve(
    cartId: string,
    items: readonly StockItemRequest[],
    ttlMs: number = this.defaultReservationTtlMs,
  ): Promise<StockReservation> {
    this.cleanupExpiredReservations();

    // Aggregate quantities per SKU in case duplicates appear
    const needed = new Map<string, number>();
    for (const item of items) {
      needed.set(item.sku, (needed.get(item.sku) ?? 0) + item.quantity);
    }

    // Phase 1: Validate all SKUs before reserving any (all-or-nothing)
    for (const [sku, qty] of needed.entries()) {
      const total = this.totalStock.get(sku) ?? 0;
      const available = Math.max(0, total - this.getReservedCount(sku));
      if (available < qty) {
        throw new InsufficientStockError(sku, qty, available);
      }
    }

    // Phase 2: Create reservation
    const reservationId = `res_${randomUUID()}`;
    const expiresAtMs = Date.now() + ttlMs;
    const normalizedItems: StockItemRequest[] = Array.from(needed.entries(), ([sku, quantity]) => ({
      sku,
      quantity,
    }));

    this.reservations.set(reservationId, {
      reservationId,
      cartId,
      items: normalizedItems,
      expiresAtMs,
      state: "RESERVED",
    });

    return {
      reservationId,
      cartId,
      items: normalizedItems,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  async releaseReservation(reservationId: string): Promise<void> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation || reservation.state !== "RESERVED") return;
    reservation.state = "RELEASED";
    this.reservations.delete(reservationId);
  }

  async commitReservation(reservationId: string): Promise<void> {
    this.cleanupExpiredReservations();
    const reservation = this.reservations.get(reservationId);
    if (!reservation || reservation.state !== "RESERVED") return;

    for (const item of reservation.items) {
      const current = this.totalStock.get(item.sku) ?? 0;
      this.totalStock.set(item.sku, Math.max(0, current - item.quantity));
    }
    reservation.state = "COMMITTED";
    this.reservations.delete(reservationId);
  }

  private getReservedCount(sku: string): number {
    let sum = 0;
    for (const res of this.reservations.values()) {
      if (res.state !== "RESERVED") continue;
      for (const item of res.items) {
        if (item.sku === sku) {
          sum += item.quantity;
        }
      }
    }
    return sum;
  }

  private cleanupExpiredReservations(): void {
    const now = Date.now();
    for (const [id, res] of this.reservations.entries()) {
      if (res.state === "RESERVED" && res.expiresAtMs <= now) {
        this.reservations.delete(id);
      }
    }
  }
}
