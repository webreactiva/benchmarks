import type { Product } from '../../domain/product.js';
import type { ProductRepository } from '../../ports/repositories.js';

/** Adaptador en memoria del puerto ProductRepository. */
export class MemoryProductRepository implements ProductRepository {
  private readonly products = new Map<string, Product>();

  constructor(catalog: Product[]) {
    for (const product of catalog) {
      this.products.set(product.id, { ...product });
    }
  }

  async findAll(): Promise<Product[]> {
    return [...this.products.values()]
      .map((product) => ({ ...product }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findById(id: string): Promise<Product | null> {
    const product = this.products.get(id);
    return product ? { ...product } : null;
  }

  async adjustStock(productId: string, delta: number): Promise<boolean> {
    const product = this.products.get(productId);
    if (!product || product.stock + delta < 0) return false;
    product.stock += delta;
    return true;
  }
}
