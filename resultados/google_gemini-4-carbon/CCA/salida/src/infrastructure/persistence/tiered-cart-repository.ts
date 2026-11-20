import type { CartRepository } from '../../application/ports.ts';
import type { Cart } from '../../domain/cart.ts';
import { ConcurrencyConflictError } from '../../domain/errors.ts';
import type { InMemoryCartRepository } from './in-memory-cart-repository.ts';

/**
 * Repositorio Multinivel (Read-Through + Write-Through Cache):
 * Combina una capa rápida en memoria L1 (equivalente a Redis en despliegues distribuidos)
 * con un almacén duradero transaccional L2 (SQLite / PostgreSQL).
 * La fuente de verdad para Control de Concurrencia Optimista es siempre L2.
 */
export class TieredCartRepository implements CartRepository {
  private readonly l1Cache: InMemoryCartRepository;
  private readonly l2Store: CartRepository;

  constructor(l1Cache: InMemoryCartRepository, l2Store: CartRepository) {
    this.l1Cache = l1Cache;
    this.l2Store = l2Store;
  }

  async findById(cartId: string): Promise<Cart | null> {
    const cached = await this.l1Cache.findById(cartId);
    if (cached) {
      return cached;
    }
    const persisted = await this.l2Store.findById(cartId);
    if (persisted) {
      this.l1Cache.putCacheSnapshot(persisted.toSnapshot());
    }
    return persisted;
  }

  async findActiveByUserId(userId: string): Promise<Cart | null> {
    const cached = await this.l1Cache.findActiveByUserId(userId);
    if (cached) {
      return cached;
    }
    const persisted = await this.l2Store.findActiveByUserId(userId);
    if (persisted) {
      this.l1Cache.putCacheSnapshot(persisted.toSnapshot());
    }
    return persisted;
  }

  async findActiveBySessionId(sessionId: string): Promise<Cart | null> {
    const cached = await this.l1Cache.findActiveBySessionId(sessionId);
    if (cached) {
      return cached;
    }
    const persisted = await this.l2Store.findActiveBySessionId(sessionId);
    if (persisted) {
      this.l1Cache.putCacheSnapshot(persisted.toSnapshot());
    }
    return persisted;
  }

  async save(cart: Cart, expectedVersion: number): Promise<void> {
    try {
      await this.l2Store.save(cart, expectedVersion);
      this.l1Cache.putCacheSnapshot(cart.toSnapshot());
    } catch (error) {
      if (error instanceof ConcurrencyConflictError) {
        // Invalidar L1 para asegurar que la siguiente lectura obtenga la versión fresca desde L2
        this.l1Cache.invalidate(cart.id);
      }
      throw error;
    }
  }

  async savePairAtomic(
    targetCart: Cart,
    targetExpectedVersion: number,
    sourceCart: Cart,
    sourceExpectedVersion: number,
  ): Promise<void> {
    try {
      await this.l2Store.savePairAtomic(
        targetCart,
        targetExpectedVersion,
        sourceCart,
        sourceExpectedVersion,
      );
      this.l1Cache.putCacheSnapshot(targetCart.toSnapshot());
      this.l1Cache.putCacheSnapshot(sourceCart.toSnapshot());
    } catch (error) {
      if (error instanceof ConcurrencyConflictError) {
        this.l1Cache.invalidate(targetCart.id);
        this.l1Cache.invalidate(sourceCart.id);
      }
      throw error;
    }
  }

  async purgeExpired(now: Date = new Date()): Promise<number> {
    await this.l1Cache.purgeExpired(now);
    return this.l2Store.purgeExpired(now);
  }
}
