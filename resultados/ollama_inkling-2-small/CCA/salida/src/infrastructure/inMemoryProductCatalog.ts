import { InsufficientStockError, ProductNotFoundError } from "../domain/errors.js";
import type { Product } from "../domain/catalog.js";
import type { ProductCatalog } from "../application/ports.js";

export class InMemoryProductCatalog implements ProductCatalog {
  private readonly products = new Map<string, Product>();

  constructor(seed: Product[] = []) {
    for (const product of seed) {
      this.products.set(product.id, { ...product });
    }
  }

  async getById(productId: string): Promise<Product | null> {
    const product = this.products.get(productId);
    return product ? { ...product } : null;
  }

  async list(): Promise<Product[]> {
    return [...this.products.values()].map((product) => ({ ...product }));
  }

  /** All-or-nothing stock decrement: validates first, then mutates. */
  async decrementStock(productId: string, quantity: number): Promise<void> {
    const product = this.products.get(productId);
    if (!product) throw new ProductNotFoundError(productId);
    if (product.stock < quantity) {
      throw new InsufficientStockError(productId, quantity, product.stock);
    }
    product.stock -= quantity;
  }
}

export const SEED_PRODUCTS: Product[] = [
  { id: "kb-mech-01", name: "Teclado mecánico", priceCents: 8999, stock: 50 },
  { id: "mouse-wireless-01", name: "Ratón inalámbrico", priceCents: 2999, stock: 100 },
  { id: "monitor-27-4k", name: "Monitor 27\" 4K", priceCents: 21999, stock: 30 },
  { id: "usb-c-hub-7", name: "Hub USB-C 7 puertos", priceCents: 4599, stock: 80 },
  { id: "anc-headphones", name: "Auriculares ANC", priceCents: 12999, stock: 40 },
];
