import type { Money } from './money.js';

/**
 * The catalog is a *separate* bounded context in the real world. The cart only
 * keeps a price snapshot on every line so the total the user sees never changes
 * under their feet; a background job can reconcile snapshots later.
 */
export interface CatalogProduct {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly description?: string;
  readonly price: Money;
  readonly currency: string;
  readonly active: boolean;
  readonly stock?: number;
  readonly imageUrl?: string;
  readonly category?: string;
  readonly attributes?: Record<string, string>;
}

export interface CatalogQuery {
  readonly category?: string;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export function productRef(product: CatalogProduct): {
  id: string;
  sku: string;
  name: string;
  price: Money;
} {
  return { id: product.id, sku: product.sku, name: product.name, price: product.price };
}
