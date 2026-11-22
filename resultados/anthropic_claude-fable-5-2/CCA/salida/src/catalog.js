/**
 * Catálogo de productos. El carrito solo guarda SKU y cantidad; nombre y precio
 * se resuelven aquí en cada lectura, de modo que el cliente nunca decide el precio.
 *
 * En producción se sustituye por un cliente del servicio de catálogo (con caché)
 * que implemente el mismo método `getMany`.
 */
export class InMemoryCatalog {
  /** @param {Array<{sku: string, name: string, price: number}>} products precio en céntimos */
  constructor(products, currency = 'EUR') {
    this.currency = currency;
    this.products = new Map(products.map((p) => [p.sku, p]));
  }

  /** @returns {Promise<Map<string, {sku: string, name: string, price: number}>>} */
  async getMany(skus) {
    const found = new Map();
    for (const sku of skus) {
      const product = this.products.get(sku);
      if (product) found.set(sku, product);
    }
    return found;
  }
}

export const sampleCatalog = () =>
  new InMemoryCatalog([
    { sku: 'CAM-001', name: 'Camiseta básica', price: 1299 },
    { sku: 'PAN-002', name: 'Pantalón vaquero', price: 3995 },
    { sku: 'ZAP-003', name: 'Zapatillas deportivas', price: 5990 },
    { sku: 'GOR-004', name: 'Gorra', price: 950 },
  ]);
