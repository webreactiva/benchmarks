"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartService = void 0;
exports.createCartService = createCartService;
exports.createDefaultCartService = createDefaultCartService;
const event_bus_1 = require("./event-bus");
const storage_1 = require("./storage");
class CartService {
    constructor(options) {
        this.storage = options.storage;
        this.eventBus = options.eventBus ?? new event_bus_1.InMemoryEventBus();
        this.maxItems = options.maxItems ?? 100;
        this.maxQuantityPerItem = options.maxQuantityPerItem ?? 999;
    }
    async createCart(cartId, metadata) {
        const now = new Date();
        const cart = {
            id: cartId,
            items: [],
            createdAt: now,
            updatedAt: now,
            metadata,
        };
        await this.storage.set(cart);
        await this.emitEvent({
            type: 'cart.created',
            cartId,
            timestamp: now,
            payload: { cart },
        });
        return cart;
    }
    async getCart(cartId) {
        return this.storage.get(cartId);
    }
    async addItem(cartId, input) {
        const cart = await this.getOrCreateCart(cartId);
        this.validateAddItem(cart, input);
        const existingItemIndex = cart.items.findIndex((item) => item.productId === input.productId);
        const now = new Date();
        if (existingItemIndex >= 0) {
            const item = cart.items[existingItemIndex];
            const newQuantity = item.quantity + input.quantity;
            this.validateQuantity(newQuantity);
            item.quantity = newQuantity;
            item.updatedAt = now;
            item.price = input.price;
            item.metadata = { ...item.metadata, ...input.metadata };
        }
        else {
            if (cart.items.length >= this.maxItems) {
                throw new Error(`Maximum number of items (${this.maxItems}) reached`);
            }
            const newItem = {
                productId: input.productId,
                name: input.name,
                price: input.price,
                currency: input.currency,
                quantity: input.quantity,
                metadata: input.metadata,
                addedAt: now,
                updatedAt: now,
            };
            cart.items.push(newItem);
        }
        cart.updatedAt = now;
        await this.storage.set(cart);
        await this.emitEvent({
            type: existingItemIndex >= 0 ? 'item.updated' : 'item.added',
            cartId,
            timestamp: now,
            payload: { productId: input.productId, quantity: input.quantity },
        });
        await this.emitEvent({
            type: 'cart.updated',
            cartId,
            timestamp: now,
            payload: { cart },
        });
        return cart;
    }
    async updateItem(cartId, input) {
        const cart = await this.getCartOrThrow(cartId);
        const itemIndex = cart.items.findIndex((item) => item.productId === input.productId);
        if (itemIndex === -1) {
            throw new Error(`Item with productId ${input.productId} not found`);
        }
        this.validateQuantity(input.quantity);
        const now = new Date();
        const item = cart.items[itemIndex];
        if (input.quantity === 0) {
            cart.items.splice(itemIndex, 1);
            await this.emitEvent({
                type: 'item.removed',
                cartId,
                timestamp: now,
                payload: { productId: input.productId },
            });
        }
        else {
            item.quantity = input.quantity;
            item.updatedAt = now;
            await this.emitEvent({
                type: 'item.quantityChanged',
                cartId,
                timestamp: now,
                payload: { productId: input.productId, quantity: input.quantity },
            });
        }
        cart.updatedAt = now;
        await this.storage.set(cart);
        await this.emitEvent({
            type: 'cart.updated',
            cartId,
            timestamp: now,
            payload: { cart },
        });
        return cart;
    }
    async removeItem(cartId, productId) {
        const cart = await this.getCartOrThrow(cartId);
        const itemIndex = cart.items.findIndex((item) => item.productId === productId);
        if (itemIndex === -1) {
            throw new Error(`Item with productId ${productId} not found`);
        }
        const now = new Date();
        cart.items.splice(itemIndex, 1);
        cart.updatedAt = now;
        await this.storage.set(cart);
        await this.emitEvent({
            type: 'item.removed',
            cartId,
            timestamp: now,
            payload: { productId },
        });
        await this.emitEvent({
            type: 'cart.updated',
            cartId,
            timestamp: now,
            payload: { cart },
        });
        return cart;
    }
    async clearCart(cartId) {
        const cart = await this.getCartOrThrow(cartId);
        const now = new Date();
        cart.items = [];
        cart.updatedAt = now;
        await this.storage.set(cart);
        await this.emitEvent({
            type: 'cart.cleared',
            cartId,
            timestamp: now,
            payload: { previousItemCount: cart.items.length },
        });
        await this.emitEvent({
            type: 'cart.updated',
            cartId,
            timestamp: now,
            payload: { cart },
        });
        return cart;
    }
    async deleteCart(cartId) {
        await this.storage.delete(cartId);
    }
    getSummary(cart) {
        const itemCount = cart.items.length;
        const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const currency = cart.items[0]?.currency ?? 'USD';
        return {
            itemCount,
            totalQuantity,
            subtotal,
            currency,
        };
    }
    getItems(cart) {
        return [...cart.items];
    }
    hasItem(cart, productId) {
        return cart.items.some((item) => item.productId === productId);
    }
    getItemQuantity(cart, productId) {
        const item = cart.items.find((item) => item.productId === productId);
        return item?.quantity ?? 0;
    }
    on(eventType, handler) {
        this.eventBus?.subscribe(eventType, handler);
    }
    off(eventType, handler) {
        this.eventBus?.unsubscribe(eventType, handler);
    }
    async getOrCreateCart(cartId) {
        let cart = await this.storage.get(cartId);
        if (!cart) {
            cart = await this.createCart(cartId);
        }
        return cart;
    }
    async getCartOrThrow(cartId) {
        const cart = await this.storage.get(cartId);
        if (!cart) {
            throw new Error(`Cart with id ${cartId} not found`);
        }
        return cart;
    }
    validateAddItem(cart, input) {
        if (input.quantity <= 0) {
            throw new Error('Quantity must be greater than 0');
        }
        if (input.price < 0) {
            throw new Error('Price cannot be negative');
        }
        if (!input.name || !input.name.trim()) {
            throw new Error('Product name is required');
        }
        if (!input.currency || !input.currency.trim()) {
            throw new Error('Currency is required');
        }
    }
    validateQuantity(quantity) {
        if (quantity < 0) {
            throw new Error('Quantity cannot be negative');
        }
        if (quantity > this.maxQuantityPerItem) {
            throw new Error(`Maximum quantity per item (${this.maxQuantityPerItem}) exceeded`);
        }
    }
    async emitEvent(event) {
        if (this.eventBus) {
            await this.eventBus.publish(event);
        }
    }
}
exports.CartService = CartService;
function createCartService(options) {
    return new CartService(options);
}
function createDefaultCartService() {
    return new CartService({
        storage: new storage_1.InMemoryStorage(),
        eventBus: new event_bus_1.InMemoryEventBus(),
    });
}
//# sourceMappingURL=cart.js.map