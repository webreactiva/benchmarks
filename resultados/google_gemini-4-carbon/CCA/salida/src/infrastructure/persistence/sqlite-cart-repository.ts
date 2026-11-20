import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { CartRepository } from '../../application/ports.ts';
import { Cart, type CartItemSnapshot, type CartSnapshot, type CartStatus } from '../../domain/cart.ts';
import { ConcurrencyConflictError } from '../../domain/errors.ts';
import type { CurrencyCode } from '../../domain/money.ts';

interface CartRow {
  id: string;
  user_id: string | null;
  session_id: string | null;
  status: string;
  currency: string;
  coupon_code: string | null;
  items_json: string;
  version: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

/**
 * Repositorio SQL transaccional (SQLite con modo WAL para lecturas concurrentes).
 * Utiliza exactamente el mismo esquema e invariantes Compare-And-Swap (WHERE id = ? AND version = ?)
 * aplicables a PostgreSQL / CockroachDB en despliegues multi-nodo.
 */
export class SqliteCartRepository implements CartRepository {
  private readonly db: DatabaseSync;

  constructor(dbPath = ':memory:') {
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS carts (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        session_id TEXT,
        status TEXT NOT NULL,
        currency TEXT NOT NULL,
        coupon_code TEXT,
        items_json TEXT NOT NULL,
        version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_carts_active_user
        ON carts (user_id, status, updated_at DESC)
        WHERE user_id IS NOT NULL AND status = 'ACTIVE';

      CREATE INDEX IF NOT EXISTS idx_carts_active_session
        ON carts (session_id, status, updated_at DESC)
        WHERE session_id IS NOT NULL AND status = 'ACTIVE';

      CREATE INDEX IF NOT EXISTS idx_carts_expires_at
        ON carts (expires_at);
    `);
  }

  async findById(cartId: string): Promise<Cart | null> {
    const stmt = this.db.prepare('SELECT * FROM carts WHERE id = ? LIMIT 1');
    const row = stmt.get(cartId) as CartRow | undefined;
    return row ? this.rowToCart(row) : null;
  }

  async findActiveByUserId(userId: string): Promise<Cart | null> {
    const nowIso = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM carts
      WHERE user_id = ? AND status = 'ACTIVE' AND expires_at > ?
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    const row = stmt.get(userId, nowIso) as CartRow | undefined;
    return row ? this.rowToCart(row) : null;
  }

  async findActiveBySessionId(sessionId: string): Promise<Cart | null> {
    const nowIso = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM carts
      WHERE session_id = ? AND status = 'ACTIVE' AND expires_at > ?
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    const row = stmt.get(sessionId, nowIso) as CartRow | undefined;
    return row ? this.rowToCart(row) : null;
  }

  async save(cart: Cart, expectedVersion: number): Promise<void> {
    this.saveSingleSync(cart.toSnapshot(), expectedVersion);
  }

  async savePairAtomic(
    targetCart: Cart,
    targetExpectedVersion: number,
    sourceCart: Cart,
    sourceExpectedVersion: number,
  ): Promise<void> {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
      this.saveSingleSync(targetCart.toSnapshot(), targetExpectedVersion);
      this.saveSingleSync(sourceCart.toSnapshot(), sourceExpectedVersion);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async purgeExpired(now: Date = new Date()): Promise<number> {
    const stmt = this.db.prepare(`
      DELETE FROM carts
      WHERE expires_at <= ? AND status IN ('ACTIVE', 'EXPIRED')
    `);
    const result = stmt.run(now.toISOString());
    return Number(result.changes);
  }

  close(): void {
    this.db.close();
  }

  private saveSingleSync(snap: CartSnapshot, expectedVersion: number): void {
    const itemsJson = JSON.stringify(snap.items);

    if (expectedVersion === 0) {
      try {
        const insertStmt = this.db.prepare(`
          INSERT INTO carts (
            id, user_id, session_id, status, currency, coupon_code,
            items_json, version, created_at, updated_at, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertStmt.run(
          snap.id,
          snap.userId,
          snap.sessionId,
          snap.status,
          snap.currency,
          snap.couponCode,
          itemsJson,
          snap.version,
          snap.createdAt,
          snap.updatedAt,
          snap.expiresAt,
        );
        return;
      } catch (err) {
        const currentVersion = this.fetchCurrentVersion(snap.id);
        if (currentVersion !== undefined) {
          throw new ConcurrencyConflictError(snap.id, 0, currentVersion);
        }
        throw err;
      }
    }

    const updateStmt = this.db.prepare(`
      UPDATE carts
      SET user_id = ?,
          session_id = ?,
          status = ?,
          currency = ?,
          coupon_code = ?,
          items_json = ?,
          version = ?,
          updated_at = ?,
          expires_at = ?
      WHERE id = ? AND version = ?
    `);

    const result = updateStmt.run(
      snap.userId,
      snap.sessionId,
      snap.status,
      snap.currency,
      snap.couponCode,
      itemsJson,
      snap.version,
      snap.updatedAt,
      snap.expiresAt,
      snap.id,
      expectedVersion,
    );

    if (Number(result.changes) !== 1) {
      const currentVersion = this.fetchCurrentVersion(snap.id);
      throw new ConcurrencyConflictError(snap.id, expectedVersion, currentVersion);
    }
  }

  private fetchCurrentVersion(cartId: string): number | undefined {
    const stmt = this.db.prepare('SELECT version FROM carts WHERE id = ? LIMIT 1');
    const row = stmt.get(cartId) as { version: number } | undefined;
    return row?.version;
  }

  private rowToCart(row: CartRow): Cart {
    const snapshot: CartSnapshot = {
      id: row.id,
      userId: row.user_id,
      sessionId: row.session_id,
      status: row.status as CartStatus,
      currency: row.currency as CurrencyCode,
      couponCode: row.coupon_code,
      items: JSON.parse(row.items_json) as CartItemSnapshot[],
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    };
    return Cart.fromSnapshot(snapshot);
  }
}
