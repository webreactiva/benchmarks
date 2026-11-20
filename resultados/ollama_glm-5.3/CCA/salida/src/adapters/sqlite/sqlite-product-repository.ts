import type { DatabaseSync } from 'node:sqlite';
import type { Product } from '../../domain/product.js';
import type { ProductRepository } from '../../ports/repositories.js';

interface ProductRow {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  stock: number;
  category: string;
  emoji: string;
}

const SELECT_ALL =
  'SELECT id, name, description, price_cents, currency, stock, category, emoji FROM products';

/** Adaptador SQLite del puerto ProductRepository. */
export class SqliteProductRepository implements ProductRepository {
  constructor(private readonly db: DatabaseSync, catalog: Product[]) {
    // Siembra idempotente: INSERT OR IGNORE conserva el stock entre reinicios.
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO products (id, name, description, price_cents, currency, stock, category, emoji)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const product of catalog) {
      stmt.run(
        product.id,
        product.name,
        product.description,
        product.priceCents,
        product.currency,
        product.stock,
        product.category,
        product.emoji,
      );
    }
  }

  async findAll(): Promise<Product[]> {
    const rows = this.db.prepare(`${SELECT_ALL} ORDER BY name`).all() as unknown as ProductRow[];
    return rows.map(rowToProduct);
  }

  async findById(id: string): Promise<Product | null> {
    const row = this.db.prepare(`${SELECT_ALL} WHERE id = ?`).get(id) as ProductRow | undefined;
    return row ? rowToProduct(row) : null;
  }

  async adjustStock(productId: string, delta: number): Promise<boolean> {
    // Atómico: solo toca la fila si el stock resultante no es negativo.
    const result = this.db
      .prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND stock + ? >= 0')
      .run(delta, productId, delta);
    return Number(result.changes) > 0;
  }
}

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
    stock: row.stock,
    category: row.category,
    emoji: row.emoji,
  };
}
