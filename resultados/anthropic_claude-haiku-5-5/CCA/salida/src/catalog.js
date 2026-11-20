/**
 * Contrato de catálogo: fuente de verdad de nombre y precio de los productos.
 *
 *   getProducts(skus) -> Promise<Map<sku, {sku, name, unitPriceCents, currency}>>
 *
 * Se pide por lotes (`getProducts`) para evitar N+1 llamadas cuando el servicio
 * necesita varios SKUs. Una implementación real debería usar caché (p. ej. Redis
 * con TTL corto) delante del servicio de catálogo.
 */
export class InMemoryCatalog {
  /** @type {Map<string, object>} */
  #products = new Map();

  /** @param {Array<{sku: string, name: string, unitPriceCents: number, currency: string}>} products */
  constructor(products = []) {
    for (const product of products) this.upsert(product);
  }

  upsert(product) {
    this.#products.set(product.sku, Object.freeze({ ...product }));
  }

  async getProducts(skus) {
    const result = new Map();
    for (const sku of new Set(skus)) {
      const product = this.#products.get(sku);
      if (product) result.set(sku, product);
    }
    return result;
  }
}
