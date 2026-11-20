import { Cart, type CartSnapshot } from '../domain/cart.js';
import { buildLineKey } from '../domain/cart-item.js';
import {
  ConcurrencyConflictError,
  DomainError,
  InsufficientStockError,
} from '../domain/errors.js';
import type { CartEvent } from '../domain/events.js';
import type {
  CartEventHandler,
  CartRepository,
  CatalogPort,
  CatalogProduct,
  EventBusPort,
  IdempotencyStore,
  InventoryPort,
  StockReservation,
} from '../ports/repositories.js';

/**
 * Repositorio en memoria basado en snapshots inmutables y bloqueo optimista.
 * Simula fielmente el comportamiento de un almacén distribuido (Redis / PostgreSQL).
 */
export class InMemoryCartRepository implements CartRepository {
  private readonly store = new Map<string, CartSnapshot>();

  public async findById(cartId: string): Promise<Cart | null> {
    const snapshot = this.store.get(cartId);
    if (!snapshot) return null;
    return Cart.fromSnapshot(structuredClone(snapshot));
  }

  public async findActiveByOwner(ownerId: string): Promise<Cart | null> {
    const now = new Date();
    for (const snapshot of this.store.values()) {
      if (snapshot.ownerId === ownerId && snapshot.status === 'ACTIVE') {
        const cart = Cart.fromSnapshot(structuredClone(snapshot));
        if (!cart.isExpired(now)) {
          return cart;
        }
      }
    }
    return null;
  }

  public async save(cart: Cart, expectedVersion: number | null): Promise<void> {
    const existing = this.store.get(cart.id);

    if (expectedVersion === null) {
      if (existing) {
        throw new ConcurrencyConflictError(cart.id, 0, existing.version);
      }
    } else {
      if (!existing) {
        throw new DomainError(
          'CART_NOT_FOUND_ON_SAVE',
          `No se puede actualizar el carrito "${cart.id}" porque no existe.`,
        );
      }
      if (existing.version !== expectedVersion) {
        throw new ConcurrencyConflictError(cart.id, expectedVersion, existing.version);
      }
    }

    this.store.set(cart.id, structuredClone(cart.toSnapshot()));
  }

  public async delete(cartId: string): Promise<boolean> {
    return this.store.delete(cartId);
  }

  public async purgeExpired(now: Date = new Date()): Promise<number> {
    let purged = 0;
    for (const [id, snapshot] of this.store.entries()) {
      const cart = Cart.fromSnapshot(snapshot);
      if (cart.isExpired(now)) {
        this.store.delete(id);
        purged += 1;
      }
    }
    return purged;
  }

  public size(): number {
    return this.store.size;
  }
}

export class InMemoryCatalogAdapter implements CatalogPort {
  private readonly products = new Map<string, CatalogProduct>();

  constructor(initialProducts: ReadonlyArray<CatalogProduct> = []) {
    for (const product of initialProducts) {
      this.upsert(product);
    }
  }

  public upsert(product: CatalogProduct): void {
    const key = buildLineKey(product.productId, product.variantId);
    this.products.set(key, product);
  }

  public async getProduct(
    productId: string,
    variantId?: string,
  ): Promise<CatalogProduct | null> {
    const key = buildLineKey(productId, variantId);
    return this.products.get(key) ?? null;
  }
}

export class InMemoryInventoryAdapter implements InventoryPort {
  private readonly stock = new Map<string, number>();

  constructor(initialStock: Record<string, number> = {}) {
    for (const [sku, qty] of Object.entries(initialStock)) {
      this.stock.set(sku, qty);
    }
  }

  public setStock(sku: string, quantity: number): void {
    this.stock.set(sku, Math.max(0, quantity));
  }

  public async getAvailableStock(sku: string): Promise<number> {
    return this.stock.get(sku) ?? 0;
  }

  public async reserveStock(reservations: ReadonlyArray<StockReservation>): Promise<void> {
    // Validación atómica: primero verificamos todos antes de descontar ninguno
    for (const res of reservations) {
      const available = this.stock.get(res.sku) ?? 0;
      if (available < res.quantity) {
        throw new InsufficientStockError(res.productId, res.quantity, available);
      }
    }

    for (const res of reservations) {
      const available = this.stock.get(res.sku) ?? 0;
      this.stock.set(res.sku, available - res.quantity);
    }
  }

  public async releaseStock(reservations: ReadonlyArray<StockReservation>): Promise<void> {
    for (const res of reservations) {
      const available = this.stock.get(res.sku) ?? 0;
      this.stock.set(res.sku, available + res.quantity);
    }
  }
}

export class InMemoryEventBus implements EventBusPort {
  private readonly handlers = new Set<CartEventHandler>();
  public readonly publishedEvents: CartEvent[] = [];

  public async publish(events: ReadonlyArray<CartEvent>): Promise<void> {
    for (const event of events) {
      this.publishedEvents.push(event);
      for (const handler of this.handlers) {
        await handler(event);
      }
    }
  }

  public subscribe(handler: CartEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}

interface StoredIdempotencyEntry<T> {
  value: T;
  expiresAt: number | null;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, StoredIdempotencyEntry<unknown>>();

  public async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    return structuredClone(entry.value) as T;
  }

  public async set<T>(key: string, value: T, ttlMs = 24 * 60 * 60 * 1000): Promise<void> {
    this.entries.set(key, {
      value: structuredClone(value),
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null,
    });
  }
}
