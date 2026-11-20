export interface StockItemRequest {
  readonly sku: string;
  readonly quantity: number;
}

export interface StockReservation {
  readonly reservationId: string;
  readonly cartId: string;
  readonly items: readonly StockItemRequest[];
  readonly expiresAt: string;
}

/**
 * Inventory Port for real-time availability checks and atomic checkout reservations.
 */
export interface InventoryProvider {
  getAvailableStock(sku: string): Promise<number>;
  getAvailableStockBatch(skus: readonly string[]): Promise<Map<string, number>>;
  /**
   * Atomically reserves stock for all requested SKUs, or fails with `InsufficientStockError`
   * without partially reserving any SKU.
   */
  reserve(
    cartId: string,
    items: readonly StockItemRequest[],
    ttlMs?: number,
  ): Promise<StockReservation>;
  releaseReservation(reservationId: string): Promise<void>;
  commitReservation(reservationId: string): Promise<void>;
}
