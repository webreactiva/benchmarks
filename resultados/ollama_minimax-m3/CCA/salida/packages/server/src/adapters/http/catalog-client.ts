import type { CatalogProduct, CatalogQuery, ProductCatalog } from '@cart/core';
import { money } from '@cart/core';

interface RawProduct {
  id?: string;
  sku?: string;
  name?: string;
  description?: string;
  price?: number | string;
  priceMinor?: number;
  currency?: string;
  active?: boolean;
  stock?: number;
  imageUrl?: string;
  category?: string;
  attributes?: Record<string, string>;
}

/**
 * Adapter for an external catalogue service.
 *
 * The cart only needs a tiny slice of the catalogue, and the catalogue is
 * read far more often than it is written: it sits behind the cache and the
 * whole cart API keeps working even if the catalogue is down.
 */
export class HttpProductCatalog implements ProductCatalog {
  constructor(
    private readonly baseUrl: string,
    private readonly options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
  ) {}

  private get fetchImpl(): typeof fetch {
    return this.options.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 3000);
    try {
      const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { accept: 'application/json', ...(init?.headers ?? {}) },
      });
      if (!response.ok) {
        throw new Error(`Catalog request failed with status ${response.status}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalize(raw: RawProduct, fallbackCurrency: string): CatalogProduct {
    const currency = (raw.currency ?? fallbackCurrency).toUpperCase();
    const amount =
      typeof raw.priceMinor === 'number'
        ? raw.priceMinor
        : typeof raw.price === 'string'
          ? Math.round(Number(raw.price) * 100)
          : Math.round(Number(raw.price ?? 0) * 100);

    return {
      id: raw.id ?? raw.sku ?? '',
      sku: raw.sku ?? raw.id ?? '',
      name: raw.name ?? raw.sku ?? 'Producto',
      ...(raw.description ? { description: raw.description } : {}),
      price: money(Number.isFinite(amount) ? amount : 0, currency),
      currency,
      active: raw.active ?? true,
      ...(raw.stock !== undefined ? { stock: raw.stock } : {}),
      ...(raw.imageUrl ? { imageUrl: raw.imageUrl } : {}),
      ...(raw.category ? { category: raw.category } : {}),
      ...(raw.attributes ? { attributes: raw.attributes } : {}),
    };
  }

  async getProduct(productId: string): Promise<CatalogProduct | null> {
    try {
      const raw = await this.request<RawProduct>(`/products/${encodeURIComponent(productId)}`);
      return this.normalize(raw, 'EUR');
    } catch {
      return null;
    }
  }

  async getProducts(productIds: readonly string[]): Promise<Map<string, CatalogProduct>> {
    const result = new Map<string, CatalogProduct>();
    if (productIds.length === 0) return result;

    const raw = await this.request<RawProduct[] | { products: RawProduct[] }>('/products/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [...productIds] }),
    }).catch(() => null);

    const list = Array.isArray(raw) ? raw : (raw?.products ?? []);
    if (list.length > 0) {
      for (const item of list) {
        const product = this.normalize(item, 'EUR');
        result.set(product.id, product);
      }
      return result;
    }

    // Fallback for catalogues without a batch endpoint.
    const fetched = await Promise.all(
      productIds.map(async (id) => [id, await this.getProduct(id)] as const),
    );
    for (const [id, product] of fetched) {
      if (product) result.set(id, product);
    }
    return result;
  }

  async list(query: CatalogQuery = {}): Promise<CatalogProduct[]> {
    const params = new URLSearchParams();
    if (query.category) params.set('category', query.category);
    if (query.search) params.set('search', query.search);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset) params.set('offset', String(query.offset));

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const raw = await this.request<RawProduct[] | { products: RawProduct[] }>(`/products${suffix}`);
    const list = Array.isArray(raw) ? raw : (raw?.products ?? []);
    return list.map((item) => this.normalize(item, 'EUR'));
  }
}
