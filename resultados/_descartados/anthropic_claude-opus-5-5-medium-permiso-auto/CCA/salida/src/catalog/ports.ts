/**
 * Puertos hacia otros bounded contexts. En producción, el catálogo y el
 * inventario suelen ser servicios independientes; aquí se definen como
 * interfaces para poder sustituir la implementación sin tocar el carrito.
 */
import type { ProductSnapshot } from '../domain/cart.ts';

export interface Product extends ProductSnapshot {
  readonly active: boolean;
}

export interface Catalog {
  /** Consulta por lotes: una sola ida y vuelta para N productos. */
  getProducts(skus: readonly string[]): Promise<ReadonlyMap<string, Product>>;
  listProducts(): Promise<readonly Product[]>;
}

export interface StockRequest {
  readonly sku: string;
  readonly quantity: number;
}

export interface Inventory {
  available(skus: readonly string[]): Promise<ReadonlyMap<string, number>>;
  /** Reserva todo o nada. Lanza OUT_OF_STOCK si alguna línea no cabe. Idempotente por reservationId. */
  reserve(reservationId: string, items: readonly StockRequest[]): Promise<void>;
  /** Libera una reserva (compensación). Idempotente. */
  release(reservationId: string): Promise<void>;
}
