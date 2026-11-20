import { Cart } from '../domain/cart.js';
import { buildLineKey } from '../domain/cart-item.js';
import { ConcurrencyConflictError, DomainError, InsufficientStockError, } from '../domain/errors.js';
/**
 * Repositorio en memoria basado en snapshots inmutables y bloqueo optimista.
 * Simula fielmente el comportamiento de un almacén distribuido (Redis / PostgreSQL).
 */
export class InMemoryCartRepository {
    store = new Map();
    async findById(cartId) {
        const snapshot = this.store.get(cartId);
        if (!snapshot)
            return null;
        return Cart.fromSnapshot(structuredClone(snapshot));
    }
    async findActiveByOwner(ownerId) {
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
    async save(cart, expectedVersion) {
        const existing = this.store.get(cart.id);
        if (expectedVersion === null) {
            if (existing) {
                throw new ConcurrencyConflictError(cart.id, 0, existing.version);
            }
        }
        else {
            if (!existing) {
                throw new DomainError('CART_NOT_FOUND_ON_SAVE', `No se puede actualizar el carrito "${cart.id}" porque no existe.`);
            }
            if (existing.version !== expectedVersion) {
                throw new ConcurrencyConflictError(cart.id, expectedVersion, existing.version);
            }
        }
        this.store.set(cart.id, structuredClone(cart.toSnapshot()));
    }
    async delete(cartId) {
        return this.store.delete(cartId);
    }
    async purgeExpired(now = new Date()) {
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
    size() {
        return this.store.size;
    }
}
export class InMemoryCatalogAdapter {
    products = new Map();
    constructor(initialProducts = []) {
        for (const product of initialProducts) {
            this.upsert(product);
        }
    }
    upsert(product) {
        const key = buildLineKey(product.productId, product.variantId);
        this.products.set(key, product);
    }
    async getProduct(productId, variantId) {
        const key = buildLineKey(productId, variantId);
        return this.products.get(key) ?? null;
    }
}
export class InMemoryInventoryAdapter {
    stock = new Map();
    constructor(initialStock = {}) {
        for (const [sku, qty] of Object.entries(initialStock)) {
            this.stock.set(sku, qty);
        }
    }
    setStock(sku, quantity) {
        this.stock.set(sku, Math.max(0, quantity));
    }
    async getAvailableStock(sku) {
        return this.stock.get(sku) ?? 0;
    }
    async reserveStock(reservations) {
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
    async releaseStock(reservations) {
        for (const res of reservations) {
            const available = this.stock.get(res.sku) ?? 0;
            this.stock.set(res.sku, available + res.quantity);
        }
    }
}
export class InMemoryEventBus {
    handlers = new Set();
    publishedEvents = [];
    async publish(events) {
        for (const event of events) {
            this.publishedEvents.push(event);
            for (const handler of this.handlers) {
                await handler(event);
            }
        }
    }
    subscribe(handler) {
        this.handlers.add(handler);
        return () => {
            this.handlers.delete(handler);
        };
    }
}
export class InMemoryIdempotencyStore {
    entries = new Map();
    async get(key) {
        const entry = this.entries.get(key);
        if (!entry)
            return null;
        if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
            this.entries.delete(key);
            return null;
        }
        return structuredClone(entry.value);
    }
    async set(key, value, ttlMs = 24 * 60 * 60 * 1000) {
        this.entries.set(key, {
            value: structuredClone(value),
            expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null,
        });
    }
}
//# sourceMappingURL=in-memory-adapters.js.map