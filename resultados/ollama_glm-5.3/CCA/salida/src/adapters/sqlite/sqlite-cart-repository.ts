import type { DatabaseSync } from 'node:sqlite';
import type { Cart } from '../../domain/cart.js';
import type { CartRepository } from '../../ports/repositories.js';

interface CartRow {
  id: string;
  discount_code: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  product_id: string;
  quantity: number;
}

/**
 * Adaptador SQLite del puerto CartRepository.
 *
 * El agregado se guarda SIEMPRE completo (upsert del carrito + reescritura de
 * sus líneas dentro de una transacción): el mapeo es trivial y no hay estados
 * intermedios raros.
 */
export class SqliteCartRepository implements CartRepository {
  constructor(private readonly db: DatabaseSync) {}

  async create(cart: Cart): Promise<void> {
    this.db
      .prepare('INSERT INTO carts (id, discount_code, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(cart.id, cart.discountCode, cart.createdAt, cart.updatedAt);
    this.insertItems(cart);
  }

  async findById(id: string): Promise<Cart | null> {
    const row = this.db
      .prepare('SELECT id, discount_code, created_at, updated_at FROM carts WHERE id = ?')
      .get(id) as CartRow | undefined;
    if (!row) return null;

    const items = this.db
      .prepare('SELECT product_id, quantity FROM cart_items WHERE cart_id = ? ORDER BY rowid')
      .all(id) as unknown as ItemRow[];

    return {
      id: row.id,
      discountCode: row.discount_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: items.map((item) => ({ productId: item.product_id, quantity: item.quantity })),
    };
  }

  async save(cart: Cart): Promise<void> {
    this.db.exec('BEGIN');
    try {
      this.db
        .prepare(`
          INSERT INTO carts (id, discount_code, created_at, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE
            SET discount_code = excluded.discount_code,
                updated_at   = excluded.updated_at
        `)
        .run(cart.id, cart.discountCode, cart.createdAt, cart.updatedAt);
      this.db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);
      this.insertItems(cart);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM carts WHERE id = ?').run(id);
  }

  private insertItems(cart: Cart): void {
    const stmt = this.db.prepare(
      'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)',
    );
    for (const item of cart.items) {
      stmt.run(cart.id, item.productId, item.quantity);
    }
  }
}
