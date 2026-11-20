import {
  Cart,
  CartItem,
  AddItemInput,
  UpdateItemInput,
  CartOptions,
  CartEvent,
  CartEventType,
  CartSummary,
  Product,
} from './types';
import { InMemoryEventBus } from './event-bus';
import { InMemoryStorage } from './storage';

export class CartService {
  private storage: CartOptions['storage'];
  private eventBus: CartOptions['eventBus'];
  private maxItems: number;
  private maxQuantityPerItem: number;

  constructor(options: CartOptions) {
    this.storage = options.storage;
    this.eventBus = options.eventBus ?? new InMemoryEventBus();
    this.maxItems = options.maxItems ?? 100;
    this.maxQuantityPerItem = options.maxQuantityPerItem ?? 999;
  }

  async createCart(cartId: string, metadata?: Record<string, unknown>): Promise<Cart> {
    const now = new Date();
    const cart: Cart = {
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

  async getCart(cartId: string): Promise<Cart | null> {
    return this.storage.get(cartId);
  }

  async addItem(cartId: string, input: AddItemInput): Promise<Cart> {
    const cart = await this.getOrCreateCart(cartId);
    this.validateAddItem(cart, input);

    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId === input.productId
    );

    const now = new Date();

    if (existingItemIndex >= 0) {
      const item = cart.items[existingItemIndex];
      const newQuantity = item.quantity + input.quantity;
      this.validateQuantity(newQuantity);

      item.quantity = newQuantity;
      item.updatedAt = now;
      item.price = input.price;
      item.metadata = { ...item.metadata, ...input.metadata };
    } else {
      if (cart.items.length >= this.maxItems) {
        throw new Error(`Maximum number of items (${this.maxItems}) reached`);
      }

      const newItem: CartItem = {
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

  async updateItem(cartId: string, input: UpdateItemInput): Promise<Cart> {
    const cart = await this.getCartOrThrow(cartId);
    const itemIndex = cart.items.findIndex(
      (item) => item.productId === input.productId
    );

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
    } else {
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

  async removeItem(cartId: string, productId: string): Promise<Cart> {
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

  async clearCart(cartId: string): Promise<Cart> {
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

  async deleteCart(cartId: string): Promise<void> {
    await this.storage.delete(cartId);
  }

  getSummary(cart: Cart): CartSummary {
    const itemCount = cart.items.length;
    const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const currency = cart.items[0]?.currency ?? 'USD';

    return {
      itemCount,
      totalQuantity,
      subtotal,
      currency,
    };
  }

  getItems(cart: Cart): CartItem[] {
    return [...cart.items];
  }

  hasItem(cart: Cart, productId: string): boolean {
    return cart.items.some((item) => item.productId === productId);
  }

  getItemQuantity(cart: Cart, productId: string): number {
    const item = cart.items.find((item) => item.productId === productId);
    return item?.quantity ?? 0;
  }

  on(eventType: CartEventType, handler: (event: CartEvent) => Promise<void> | void): void {
    this.eventBus?.subscribe(eventType, handler);
  }

  off(eventType: CartEventType, handler: (event: CartEvent) => Promise<void> | void): void {
    this.eventBus?.unsubscribe(eventType, handler);
  }

  private async getOrCreateCart(cartId: string): Promise<Cart> {
    let cart = await this.storage.get(cartId);
    if (!cart) {
      cart = await this.createCart(cartId);
    }
    return cart;
  }

  private async getCartOrThrow(cartId: string): Promise<Cart> {
    const cart = await this.storage.get(cartId);
    if (!cart) {
      throw new Error(`Cart with id ${cartId} not found`);
    }
    return cart;
  }

  private validateAddItem(cart: Cart, input: AddItemInput): void {
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

  private validateQuantity(quantity: number): void {
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }
    if (quantity > this.maxQuantityPerItem) {
      throw new Error(`Maximum quantity per item (${this.maxQuantityPerItem}) exceeded`);
    }
  }

  private async emitEvent(event: CartEvent): Promise<void> {
    if (this.eventBus) {
      await this.eventBus.publish(event);
    }
  }
}

export function createCartService(options: CartOptions): CartService {
  return new CartService(options);
}

export function createDefaultCartService(): CartService {
  return new CartService({
    storage: new InMemoryStorage(),
    eventBus: new InMemoryEventBus(),
  });
}