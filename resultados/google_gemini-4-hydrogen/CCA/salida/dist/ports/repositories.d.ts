import type { Cart } from '../domain/cart.js';
import type { TaxCategory } from '../domain/cart-item.js';
import type { CartEvent } from '../domain/events.js';
import type { Money } from '../domain/money.js';
export interface CatalogProduct {
    productId: string;
    variantId?: string;
    sku: string;
    name: string;
    categoryId: string;
    taxCategory: TaxCategory;
    unitPrice: Money;
    weightGrams?: number;
    active: boolean;
}
export interface StockReservation {
    sku: string;
    productId: string;
    quantity: number;
}
export interface CartRepository {
    findById(cartId: string): Promise<Cart | null>;
    findActiveByOwner(ownerId: string): Promise<Cart | null>;
    /**
     * Persiste el carrito usando control de concurrencia optimista.
     * @param cart Instancia actual del carrito tras la mutación.
     * @param expectedVersion Versión anterior en almacén (`null` si es creación).
     */
    save(cart: Cart, expectedVersion: number | null): Promise<void>;
    delete(cartId: string): Promise<boolean>;
    purgeExpired(now?: Date): Promise<number>;
}
export interface CatalogPort {
    getProduct(productId: string, variantId?: string): Promise<CatalogProduct | null>;
}
export interface InventoryPort {
    getAvailableStock(sku: string): Promise<number>;
    reserveStock(reservations: ReadonlyArray<StockReservation>): Promise<void>;
    releaseStock(reservations: ReadonlyArray<StockReservation>): Promise<void>;
}
export type CartEventHandler = (event: CartEvent) => void | Promise<void>;
export interface EventBusPort {
    publish(events: ReadonlyArray<CartEvent>): Promise<void>;
    subscribe(handler: CartEventHandler): () => void;
}
export interface IdempotencyStore {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
}
//# sourceMappingURL=repositories.d.ts.map