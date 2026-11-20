import { Cart, type CartSnapshot } from '../../domain/cart.ts';
import { ConcurrencyConflictError } from '../../domain/errors.ts';
import type { CartRepository } from '../../application/ports.ts';

export interface InMemoryCartRepositoryOptions {
  /** Capacidad máxima de entradas en memoria (política LRU para proteger RAM en L1) */
  maxEntries?: number;
}

export class InMemoryCartRepository implements CartRepository {
  private readonly store = new Map<string, CartSnapshot>();
  private readonly activeByUser = new Map<string, string>();
  private readonly activeBySession = new Map<string, string>();
  private readonly maxEntries: number;

  constructor(options: InMemoryCartRepositoryOptions = {}) {
    this.maxEntries = options.maxEntries ?? 10_000;
  }

  async findById(cartId: string): Promise<Cart | null> {
    const snap = this.store.get(cartId);
    if (!snap) return null;
    // Refrescar orden LRU
    this.store.delete(cartId);
    this.store.set(cartId, snap);
    return Cart.fromSnapshot(structuredClone(snap));
  }

  async findActiveByUserId(userId: string): Promise<Cart | null> {
    const cartId = this.activeByUser.get(userId);
    if (!cartId) return null;
    const cart = await this.findById(cartId);
    if (!cart || cart.status !== 'ACTIVE' || cart.isExpired()) {
      this.activeByUser.delete(userId);
      return null;
    }
    return cart;
  }

  async findActiveBySessionId(sessionId: string): Promise<Cart | null> {
    const cartId = this.activeBySession.get(sessionId);
    if (!cartId) return null;
    const cart = await this.findById(cartId);
    if (!cart || cart.status !== 'ACTIVE' || cart.isExpired()) {
      this.activeBySession.delete(sessionId);
      return null;
    }
    return cart;
  }

  async save(cart: Cart, expectedVersion: number): Promise<void> {
    this.validateCompareAndSwap(cart.id, expectedVersion);
    this.writeSnapshot(cart.toSnapshot());
  }

  async savePairAtomic(
    targetCart: Cart,
    targetExpectedVersion: number,
    sourceCart: Cart,
    sourceExpectedVersion: number,
  ): Promise<void> {
    this.validateCompareAndSwap(targetCart.id, targetExpectedVersion);
    this.validateCompareAndSwap(sourceCart.id, sourceExpectedVersion);
    this.writeSnapshot(targetCart.toSnapshot());
    this.writeSnapshot(sourceCart.toSnapshot());
  }

  invalidate(cartId: string): void {
    const existing = this.store.get(cartId);
    if (existing) {
      if (existing.userId && this.activeByUser.get(existing.userId) === cartId) {
        this.activeByUser.delete(existing.userId);
      }
      if (existing.sessionId && this.activeBySession.get(existing.sessionId) === cartId) {
        this.activeBySession.delete(existing.sessionId);
      }
      this.store.delete(cartId);
    }
  }

  putCacheSnapshot(snapshot: CartSnapshot): void {
    this.writeSnapshot(snapshot);
  }

  async purgeExpired(now: Date = new Date()): Promise<number> {
    const nowMs = now.getTime();
    let purged = 0;
    for (const [id, snap] of this.store.entries()) {
      if (new Date(snap.expiresAt).getTime() <= nowMs) {
        this.invalidate(id);
        purged += 1;
      }
    }
    return purged;
  }

  private validateCompareAndSwap(cartId: string, expectedVersion: number): void {
    const existing = this.store.get(cartId);
    if (expectedVersion === 0) {
      if (existing) {
        throw new ConcurrencyConflictError(cartId, 0, existing.version);
      }
      return;
    }
    if (!existing || existing.version !== expectedVersion) {
      throw new ConcurrencyConflictError(cartId, expectedVersion, existing?.version);
    }
  }

  private writeSnapshot(rawSnapshot: CartSnapshot): void {
    const snapshot = structuredClone(rawSnapshot);
    const previous = this.store.get(snapshot.id);

    if (previous) {
      if (previous.userId && this.activeByUser.get(previous.userId) === snapshot.id) {
        this.activeByUser.delete(previous.userId);
      }
      if (previous.sessionId && this.activeBySession.get(previous.sessionId) === snapshot.id) {
        this.activeBySession.delete(previous.sessionId);
      }
      this.store.delete(snapshot.id);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.invalidate(oldestKey);
      }
    }

    this.store.set(snapshot.id, snapshot);

    if (snapshot.status === 'ACTIVE') {
      if (snapshot.userId) {
        this.activeByUser.set(snapshot.userId, snapshot.id);
      }
      if (snapshot.sessionId) {
        this.activeBySession.set(snapshot.sessionId, snapshot.id);
      }
    }
  }
}
