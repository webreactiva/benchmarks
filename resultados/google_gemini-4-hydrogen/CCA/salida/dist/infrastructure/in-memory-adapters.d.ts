import { Cart } from '../domain/cart.js';
import type { CartEvent } from '../domain/events.js';
import type { CartEventHandler, CartRepository, CatalogPort, CatalogProduct, EventBusPort, IdempotencyStore, InventoryPort, StockReservation } from '../ports/repositories.js';
/**
 * Repositorio en memoria basado en snapshots inmutables y bloqueo optimista.
 * Simula fielmente el comportamiento de un almacén distribuido (Redis / PostgreSQL).
 */
export declare class InMemoryCartRepository implements CartRepository {
    private readonly store;
    findById(cartId: string): Promise<Cart | null>;
    findActiveByOwner(ownerId: string): Promise<Cart | null>;
    save(cart: Cart, expectedVersion: number | null): Promise<void>;
    delete(cartId: string): Promise<boolean>;
    purgeExpired(now?: Date): Promise<number>;
    size(): number;
}
export declare class InMemoryCatalogAdapter implements CatalogPort {
    private readonly products;
    constructor(initialProducts?: ReadonlyArray<CatalogProduct>);
    upsert(product: CatalogProduct): void;
    getProduct(productId: string, variantId?: string): Promise<CatalogProduct | null>;
}
export declare class InMemoryInventoryAdapter implements InventoryPort {
    private readonly stock;
    constructor(initialStock?: Record<string, number>);
    setStock(sku: string, quantity: number): void;
    getAvailableStock(sku: string): Promise<number>;
    reserveStock(reservations: ReadonlyArray<StockReservation>): Promise<void>;
    releaseStock(reservations: ReadonlyArray<StockReservation>): Promise<void>;
}
export declare class InMemoryEventBus implements EventBusPort {
    private readonly handlers;
    readonly publishedEvents: CartEvent[];
    publish(events: ReadonlyArray<CartEvent>): Promise<void>;
    subscribe(handler: CartEventHandler): () => void;
}
export declare class InMemoryIdempotencyStore implements IdempotencyStore {
    private readonly entries;
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
}
//# sourceMappingURL=in-memory-adapters.d.ts.map