import type { CatalogProduct, CatalogQuery } from '../../domain/product.js';
import { money } from '../../domain/money.js';
import type { ProductCatalog } from '../../application/ports.js';

export interface SeedProduct {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly priceInMinor: number;
  readonly currency?: string;
  readonly stock?: number;
  readonly category: string;
  readonly imageUrl?: string;
  readonly attributes?: Record<string, string>;
}

export const seedProducts: readonly SeedProduct[] = [
  {
    id: 'sku-espresso',
    sku: 'ESPRESSO-01',
    name: 'Granos de espresso Etiopía',
    description: 'Tueste medio, notas cítricas y jazmín. 250 g.',
    priceInMinor: 1290,
    stock: 120,
    category: 'café',
    imageUrl: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400',
    attributes: { origin: 'Etiopía', weight: '250 g', roast: 'medio' },
  },
  {
    id: 'sku-chemex',
    sku: 'CHEMEX-06',
    name: 'Chemex 6 tazas',
    description: 'Jarra de cristal borosilicato con filtro de papel.',
    priceInMinor: 5900,
    stock: 25,
    category: 'accesorios',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400',
    attributes: { capacity: '6 tazas', material: 'vidrio' },
  },
  {
    id: 'sku-molinillo',
    sku: 'MOLINILLO-02',
    name: 'Molinillo de mano Hario',
    description: 'Molienda regulable, Picador de acero inoxidable.',
    priceInMinor: 2450,
    stock: 40,
    category: 'accesorios',
    imageUrl: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400',
    attributes: { material: 'acero', tipo: 'manual' },
  },
  {
    id: 'sku-bolas',
    sku: 'BOLAS-12',
    name: 'Bolas de cacao 70%',
    description: 'Pack de 12 bolas con cobertura belge rellena de caramelo.',
    priceInMinor: 1150,
    stock: 200,
    category: 'chocolate',
    imageUrl: 'https://images.unsplash.com/photo-1575377427642-087cf684f29d?w=400',
    attributes: { cobertura: '70 %', unidades: '12' },
  },
  {
    id: 'sku-tostado',
    sku: 'TOSTADO-05',
    name: 'Café de especialidad tostado',
    description: 'Selección de fin de temporada, tueste medio-oscuro, 1 kg.',
    priceInMinor: 3450,
    stock: 60,
    category: 'café',
    imageUrl: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=400',
    attributes: { weight: '1 kg', roast: 'medio-oscuro' },
  },
  {
    id: 'sku-taza',
    sku: 'TAZA-01',
    name: 'Taza de cerámica «Origen»',
    description: 'Taza artesanal de 300 ml, apta para lavavajillas.',
    priceInMinor: 1490,
    stock: 80,
    category: 'accesorios',
    imageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400',
    attributes: { capacity: '300 ml', material: 'cerámica' },
  },
  {
    id: 'sku-varietal',
    sku: 'VARIETAL-03',
    name: 'Café varietal Geisha',
    description: 'Lote limitado, tueste claro, notes florales y mango.',
    priceInMinor: 8900,
    stock: 8,
    category: 'café',
    imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400',
    attributes: { origin: 'Panamá', weight: '200 g', roast: 'claro' },
  },
  {
    id: 'sku-syrup',
    sku: 'SIROP-VAINILLA',
    name: 'Sirope de vainilla artesano',
    description: 'Vainilla de Madagascar en base de azúcar de caña.',
    priceInMinor: 990,
    stock: 150,
    category: 'otros',
    imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400',
    attributes: { volume: '250 ml', vegan: 'no' },
  },
];

export class InMemoryProductCatalog implements ProductCatalog {
  private readonly products = new Map<string, CatalogProduct>();

  constructor(products: readonly SeedProduct[] = seedProducts, currency = 'EUR') {
    for (const product of products) {
      this.products.set(product.id, {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        price: money(product.priceInMinor, product.currency ?? currency),
        currency: product.currency ?? currency,
        active: true,
        ...(product.stock !== undefined ? { stock: product.stock } : {}),
        ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
        category: product.category,
        ...(product.attributes ? { attributes: product.attributes } : {}),
      });
    }
  }

  async getProduct(productId: string): Promise<CatalogProduct | null> {
    return this.products.get(productId) ?? null;
  }

  async getProducts(productIds: readonly string[]): Promise<Map<string, CatalogProduct>> {
    const result = new Map<string, CatalogProduct>();
    for (const id of productIds) {
      const product = this.products.get(id);
      if (product) result.set(id, product);
    }
    return result;
  }

  async list(query: CatalogQuery = {}): Promise<CatalogProduct[]> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const search = query.search?.trim().toLowerCase();

    const filtered = [...this.products.values()].filter((product) => {
      if (query.category && product.category !== query.category) return false;
      if (!search) return true;
      return (
        product.name.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search) ||
        product.description?.toLowerCase().includes(search)
      );
    });

    return filtered.slice(offset, offset + limit);
  }
}
