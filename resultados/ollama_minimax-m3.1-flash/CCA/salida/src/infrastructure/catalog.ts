import type { Catalog, CatalogLookup, CatalogProduct } from '../domain/catalog.js';

const DEFAULT_PRODUCTS: CatalogProduct[] = [
  {
    productId: 'prod-tea',
    variantId: null,
    sku: 'TEA-001',
    name: 'Té verde orgánico 250g',
    unitPriceCents: 1_290,
    currency: 'EUR',
    active: true,
    stock: 500,
    volumeBreaks: [{ minQuantity: 3, discountBps: 500 }],
    metadata: { category: 'alimentación' },
  },
  {
    productId: 'prod-mug',
    variantId: 'var-blue',
    sku: 'MUG-BLUE',
    name: 'Taza cerámica azul',
    unitPriceCents: 1_890,
    currency: 'EUR',
    active: true,
    stock: 120,
    volumeBreaks: [{ minQuantity: 4, discountBps: 1_000 }],
    metadata: { category: 'hogar' },
  },
  {
    productId: 'prod-mug',
    variantId: 'var-red',
    sku: 'MUG-RED',
    name: 'Taza cerámica roja',
    unitPriceCents: 1_890,
    currency: 'EUR',
    active: true,
    stock: 0,
    volumeBreaks: [{ minQuantity: 4, discountBps: 1_000 }],
    metadata: { category: 'hogar' },
  },
  {
    productId: 'prod-lamp',
    variantId: null,
    sku: 'LAMP-100',
    name: 'Lámpara de mesaMinimal',
    unitPriceCents: 4_990,
    currency: 'EUR',
    active: true,
    stock: 40,
    volumeBreaks: [],
    metadata: { category: 'hogar' },
  },
  {
    productId: 'prod-chair',
    variantId: null,
    sku: 'CHAIR-9',
    name: 'Silla de madera',
    unitPriceCents: 129_990,
    currency: 'EUR',
    active: true,
    stock: 5,
    volumeBreaks: [],
    metadata: { category: 'muebles' },
  },
  {
    productId: 'prod-notebook',
    variantId: null,
    sku: 'NOTE-A5',
    name: 'Cuaderno A5',
    unitPriceCents: 850,
    currency: 'EUR',
    active: true,
    stock: 900,
    volumeBreaks: [{ minQuantity: 10, discountBps: 1_500 }],
    metadata: { category: 'papelería' },
  },
  {
    productId: 'prod-discontinued',
    variantId: null,
    sku: 'OLD-001',
    name: 'Producto descatalogado',
    unitPriceCents: 500,
    currency: 'EUR',
    active: false,
    stock: 10,
    volumeBreaks: [],
    metadata: {},
  },
];

export class MemoryCatalog implements Catalog {
  private readonly products = new Map<string, CatalogProduct>();

  constructor(products: CatalogProduct[] = DEFAULT_PRODUCTS) {
    for (const product of products) {
      this.products.set(this.key(product.productId, product.variantId), product);
    }
  }

  async getProduct(lookup: CatalogLookup): Promise<CatalogProduct | null> {
    const variantId = lookup.variantId ?? null;
    const exact = this.products.get(this.key(lookup.productId, variantId));
    if (exact) return exact;
    if (variantId === null) return null;
    const base = this.products.get(this.key(lookup.productId, null));
    return base ?? null;
  }

  private key(productId: string, variantId: string | null): string {
    return `${productId}::${variantId ?? ''}`;
  }
}

/** Catálogo remoto: el precio SIEMPRE se resuelve en el servidor. */
export class HttpCatalog implements Catalog {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, timeoutMs: number) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  async getProduct(lookup: CatalogLookup): Promise<CatalogProduct | null> {
    const url = new URL(`${this.baseUrl}/products/${encodeURIComponent(lookup.productId)}`);
    if (lookup.variantId) url.searchParams.set('variantId', lookup.variantId);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Catálogo respondió ${response.status}`);
      return (await response.json()) as CatalogProduct;
    } finally {
      clearTimeout(timer);
    }
  }
}
