import type { Money } from "../domain/money.ts";

export interface CatalogProduct {
  readonly sku: string;
  readonly name: string;
  readonly category: string;
  readonly price: Money;
  readonly active: boolean;
  readonly taxExempt?: boolean;
  readonly metadata?: Record<string, string>;
}

/**
 * Product Catalog Port.
 * Exposes batch lookup (`getProducts`) to prevent N+1 queries during cart hydration and checkout.
 */
export interface CatalogProvider {
  getProduct(sku: string): Promise<CatalogProduct | null>;
  getProducts(skus: readonly string[]): Promise<Map<string, CatalogProduct>>;
}
