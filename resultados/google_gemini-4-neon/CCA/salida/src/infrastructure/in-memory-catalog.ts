import { Money } from "../domain/money.ts";
import type { CatalogProduct, CatalogProvider } from "../ports/catalog-provider.ts";

export class InMemoryCatalogProvider implements CatalogProvider {
  private readonly products = new Map<string, CatalogProduct>();

  constructor(initialProducts: readonly CatalogProduct[] = []) {
    for (const product of initialProducts) {
      this.products.set(product.sku, product);
    }
  }

  upsertProduct(product: CatalogProduct): void {
    this.products.set(product.sku, product);
  }

  removeProduct(sku: string): boolean {
    return this.products.delete(sku);
  }

  listProducts(): CatalogProduct[] {
    return Array.from(this.products.values());
  }

  async getProduct(sku: string): Promise<CatalogProduct | null> {
    const product = this.products.get(sku);
    return product && product.active ? product : null;
  }

  async getProducts(skus: readonly string[]): Promise<Map<string, CatalogProduct>> {
    const result = new Map<string, CatalogProduct>();
    for (const sku of skus) {
      const product = this.products.get(sku);
      if (product && product.active) {
        result.set(sku, product);
      }
    }
    return result;
  }
}

export function createSampleCatalog(): InMemoryCatalogProvider {
  return new InMemoryCatalogProvider([
    {
      sku: "LAPTOP-PRO-15",
      name: "Laptop Pro 15\"",
      category: "electronics",
      price: Money.ofMajor(1299.0, "EUR"),
      active: true,
    },
    {
      sku: "MOUSE-ERGO-01",
      name: "Ratón Ergonómico Inalámbrico",
      category: "accessories",
      price: Money.ofMajor(49.9, "EUR"),
      active: true,
    },
    {
      sku: "KEYB-MECH-87",
      name: "Teclado Mecánico TKL",
      category: "accessories",
      price: Money.ofMajor(119.0, "EUR"),
      active: true,
    },
    {
      sku: "COFFEE-BEAN-1KG",
      name: "Café de Especialidad 1kg",
      category: "groceries",
      price: Money.ofMajor(24.5, "EUR"),
      active: true,
      taxExempt: true,
    },
    {
      sku: "TSHIRT-DEV-M",
      name: "Camiseta Algodón Orgánico (M)",
      category: "apparel",
      price: Money.ofMajor(19.95, "EUR"),
      active: true,
    },
  ]);
}
