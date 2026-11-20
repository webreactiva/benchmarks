import { Cart, CartItem, AddItemInput, UpdateItemInput, CartOptions, CartEvent, CartEventType, CartSummary } from './types';
export declare class CartService {
    private storage;
    private eventBus;
    private maxItems;
    private maxQuantityPerItem;
    constructor(options: CartOptions);
    createCart(cartId: string, metadata?: Record<string, unknown>): Promise<Cart>;
    getCart(cartId: string): Promise<Cart | null>;
    addItem(cartId: string, input: AddItemInput): Promise<Cart>;
    updateItem(cartId: string, input: UpdateItemInput): Promise<Cart>;
    removeItem(cartId: string, productId: string): Promise<Cart>;
    clearCart(cartId: string): Promise<Cart>;
    deleteCart(cartId: string): Promise<void>;
    getSummary(cart: Cart): CartSummary;
    getItems(cart: Cart): CartItem[];
    hasItem(cart: Cart, productId: string): boolean;
    getItemQuantity(cart: Cart, productId: string): number;
    on(eventType: CartEventType, handler: (event: CartEvent) => Promise<void> | void): void;
    off(eventType: CartEventType, handler: (event: CartEvent) => Promise<void> | void): void;
    private getOrCreateCart;
    private getCartOrThrow;
    private validateAddItem;
    private validateQuantity;
    private emitEvent;
}
export declare function createCartService(options: CartOptions): CartService;
export declare function createDefaultCartService(): CartService;
//# sourceMappingURL=cart.d.ts.map