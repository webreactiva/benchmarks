import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Abre (o crea) la base de datos SQLite nativa de Node (node:sqlite, sin
 * dependencias nativas que compilar) y garantiza el esquema. Cambiar a
 * PostgreSQL u otra BD no toca este archivo: se escribe un adaptador nuevo
 * para los puertos (src/ports/repositories.ts).
 */
export function openDatabase(file: string): DatabaseSync {
  if (file !== ':memory:') {
    mkdirSync(dirname(file), { recursive: true });
  }

  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS carts (
      id            TEXT PRIMARY KEY,
      discount_code TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      cart_id    TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      quantity   INTEGER NOT NULL CHECK (quantity > 0),
      PRIMARY KEY (cart_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS products (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT NOT NULL,
      price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
      currency    TEXT NOT NULL DEFAULT 'EUR',
      stock       INTEGER NOT NULL CHECK (stock >= 0),
      category    TEXT NOT NULL,
      emoji       TEXT NOT NULL
    );
  `);
  return db;
}
