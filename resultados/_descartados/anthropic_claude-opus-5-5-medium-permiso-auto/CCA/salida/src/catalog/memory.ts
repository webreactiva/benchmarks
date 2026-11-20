import { BusinessConflictError } from '../domain/errors.ts';
import type { Catalog, Inventory, Product, StockRequest } from './ports.ts';

export class InMemoryCatalog implements Catalog {
  readonly #products = new Map<string, Product>();

  constructor(products: Iterable<Product> = []) {
    for (const p of products) this.#products.set(p.sku, p);
  }

  upsert(product: Product): void {
    this.#products.set(product.sku, product);
  }

  async getProducts(skus: readonly string[]): Promise<ReadonlyMap<string, Product>> {
    const out = new Map<string, Product>();
    for (const sku of skus) {
      const p = this.#products.get(sku);
      if (p) out.set(sku, p);
    }
    return out;
  }

  async listProducts(): Promise<readonly Product[]> {
    return [...this.#products.values()].filter((p) => p.active);
  }
}

export class InMemoryInventory implements Inventory {
  readonly #stock = new Map<string, number>();
  readonly #reservations = new Map<string, readonly StockRequest[]>();

  constructor(stock: Record<string, number> = {}) {
    for (const [sku, qty] of Object.entries(stock)) this.#stock.set(sku, qty);
  }

  setStock(sku: string, quantity: number): void {
    this.#stock.set(sku, quantity);
  }

  async available(skus: readonly string[]): Promise<ReadonlyMap<string, number>> {
    return new Map(skus.map((s) => [s, this.#stock.get(s) ?? 0]));
  }

  async reserve(reservationId: string, items: readonly StockRequest[]): Promise<void> {
    if (this.#reservations.has(reservationId)) return;
    const shortages = items.filter((i) => (this.#stock.get(i.sku) ?? 0) < i.quantity);
    if (shortages.length > 0) throw outOfStock(shortages.map((s) => s.sku));
    for (const i of items) this.#stock.set(i.sku, (this.#stock.get(i.sku) ?? 0) - i.quantity);
    this.#reservations.set(reservationId, items);
  }

  async release(reservationId: string): Promise<void> {
    const items = this.#reservations.get(reservationId);
    if (!items) return;
    for (const i of items) this.#stock.set(i.sku, (this.#stock.get(i.sku) ?? 0) + i.quantity);
    this.#reservations.delete(reservationId);
  }
}

export function outOfStock(skus: readonly string[]): BusinessConflictError {
  return new BusinessConflictError('OUT_OF_STOCK', 'Stock insuficiente', { skus });
}
