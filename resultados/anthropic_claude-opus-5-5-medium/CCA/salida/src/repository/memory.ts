/**
 * Implementaciones en memoria: útiles para desarrollo y tests, o para una
 * única instancia. Serializan a JSON para imitar el comportamiento de un
 * almacén remoto (sin aliasing de objetos).
 */
import type { Cart } from '../domain/cart.ts';
import { ConcurrencyError } from '../domain/errors.ts';
import type { CartRepository, IdempotencyRecord, IdempotencyStore } from './ports.ts';

class TtlMap {
  readonly #data = new Map<string, { value: string; expiresAt: number }>();
  readonly #now: () => number;
  #ops = 0;

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  get(key: string): string | null {
    const e = this.#data.get(key);
    if (!e) return null;
    if (e.expiresAt <= this.#now()) {
      this.#data.delete(key);
      return null;
    }
    return e.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    this.#data.set(key, { value, expiresAt: this.#now() + ttlSeconds * 1000 });
    if (++this.#ops % 1000 === 0) this.#sweep();
  }

  delete(key: string): void {
    this.#data.delete(key);
  }

  #sweep(): void {
    const now = this.#now();
    for (const [k, e] of this.#data) if (e.expiresAt <= now) this.#data.delete(k);
  }
}

export class InMemoryCartRepository implements CartRepository {
  readonly #carts: TtlMap;
  readonly #owners: TtlMap;

  constructor(now: () => number = Date.now) {
    this.#carts = new TtlMap(now);
    this.#owners = new TtlMap(now);
  }

  async get(id: string): Promise<Cart | null> {
    const raw = this.#carts.get(id);
    return raw ? (JSON.parse(raw) as Cart) : null;
  }

  async save(cart: Cart, expectedVersion: number, ttlSeconds: number): Promise<void> {
    const raw = this.#carts.get(cart.id);
    const currentVersion = raw ? (JSON.parse(raw) as Cart).version : 0;
    if (currentVersion !== expectedVersion) throw new ConcurrencyError(cart.id);
    this.#carts.set(cart.id, JSON.stringify(cart), ttlSeconds);
  }

  async findActiveCartId(ownerId: string): Promise<string | null> {
    return this.#owners.get(ownerId);
  }

  async setActiveCartId(ownerId: string, cartId: string, ttlSeconds: number): Promise<void> {
    this.#owners.set(ownerId, cartId, ttlSeconds);
  }

  async clearActiveCartId(ownerId: string, cartId: string): Promise<void> {
    if (this.#owners.get(ownerId) === cartId) this.#owners.delete(ownerId);
  }
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  readonly #data = new TtlMap();

  async claim(key: string, fingerprint: string, ttlSeconds: number): Promise<IdempotencyRecord | null> {
    const existing = this.#data.get(key);
    if (existing) return JSON.parse(existing) as IdempotencyRecord;
    this.#data.set(key, JSON.stringify({ state: 'in_progress', fingerprint }), ttlSeconds);
    return null;
  }

  async complete(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<void> {
    this.#data.set(key, JSON.stringify(record), ttlSeconds);
  }

  async release(key: string): Promise<void> {
    this.#data.delete(key);
  }
}
