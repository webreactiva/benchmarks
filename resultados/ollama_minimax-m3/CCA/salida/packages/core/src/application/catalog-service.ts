import { ProductNotFoundError, ProductUnavailableError } from '../domain/errors.js';
import type { CatalogProduct, CatalogQuery } from '../domain/product.js';
import type { Cache, ProductCatalog } from './ports.js';

/**
 * Read-through cache in front of the catalog.
 *
 * The cart is on the hot path of every page view, but the catalog changes
 * rarely: caching the catalog locally keeps the cart API independent from the
 * catalog service availability and removes a network hop per line.
 */
export class CachedProductCatalog implements ProductCatalog {
  constructor(
    private readonly inner: ProductCatalog,
    private readonly cache: Cache,
    private readonly ttlMs: number,
  ) {}

  async getProduct(productId: string): Promise<CatalogProduct | null> {
    const cached = await this.cache.get<CatalogProduct | null>(`catalog:product:${productId}`);
    if (cached !== null) return cached;
    const product = await this.inner.getProduct(productId);
    await this.cache.set(`catalog:product:${productId}`, product, this.ttlMs);
    return product;
  }

  async getProducts(productIds: readonly string[]): Promise<Map<string, CatalogProduct>> {
    const unique = [...new Set(productIds)];
    const result = new Map<string, CatalogProduct>();
    const missing: string[] = [];

    for (const id of unique) {
      const cached = await this.cache.get<CatalogProduct | null>(`catalog:product:${id}`);
      if (cached === null) {
        missing.push(id);
      } else {
        result.set(id, cached);
      }
    }

    if (missing.length > 0) {
      const fetched = await this.inner.getProducts(missing);
      for (const [id, product] of fetched) {
        result.set(id, product);
        await this.cache.set(`catalog:product:${id}`, product, this.ttlMs);
      }
      for (const id of missing) {
        if (!fetched.has(id)) {
          await this.cache.set(`catalog:product:${id}`, null, this.ttlMs);
        }
      }
    }

    return result;
  }

  async list(query: CatalogQuery = {}): Promise<CatalogProduct[]> {
    const key = `catalog:list:${JSON.stringify(query)}`;
    const cached = await this.cache.get<CatalogProduct[]>(key);
    if (cached !== null) return cached;
    const products = await this.inner.list(query);
    await this.cache.set(key, products, this.ttlMs);
    return products;
  }

  /** Drops cached entries (used by the admin API / catalog change events). */
  async invalidate(productId?: string): Promise<void> {
    if (productId) {
      await this.cache.delete(`catalog:product:${productId}`);
      return;
    }
    await this.cache.delete('catalog:list:{}');
  }
}

export class CatalogService {
  constructor(private readonly catalog: ProductCatalog) {}

  /**
   * Resolves the products required by a cart operation.
   * Fails fast with a precise error so the client can highlight the offending line.
   */
  async requireProducts(productIds: readonly string[]): Promise<Map<string, CatalogProduct>> {
    const products = await this.catalog.getProducts(productIds);
    for (const id of productIds) {
      const product = products.get(id);
      if (!product) throw new ProductNotFoundError(id);
      if (!product.active) throw new ProductUnavailableError(id, 'the product is not active');
    }
    return products;
  }
}
