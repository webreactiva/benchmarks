import { Cart, type CartLimits } from '../domain/cart.js';
import type { CurrencyCode } from '../domain/money.js';
import type { CartPricingSummary, PricingEngine } from '../pricing/pricing-engine.js';
import type { PromotionRegistry } from '../promotions/promotion.js';
import type { CartRepository, CatalogPort, EventBusPort, IdempotencyStore, InventoryPort } from '../ports/repositories.js';
export interface CartServiceConfig {
    defaultCurrency?: CurrencyCode;
    defaultTtlMs?: number | null;
    defaultLimits?: Partial<CartLimits>;
    maxConcurrencyRetries?: number;
}
export interface AddItemCommand {
    cartId: string;
    productId: string;
    variantId?: string;
    quantity: number;
    metadata?: Record<string, string | number | boolean>;
    expectedVersion?: number;
    idempotencyKey?: string;
}
export interface UpdateQuantityCommand {
    cartId: string;
    lineKey: string;
    quantity: number;
    expectedVersion?: number;
}
export interface CheckoutCommand {
    cartId: string;
    expectedVersion?: number;
    idempotencyKey?: string;
}
export interface CheckoutLineReceipt {
    lineKey: string;
    productId: string;
    variantId?: string;
    sku: string;
    name: string;
    quantity: number;
    unitPriceMinor: number;
    netSubtotalMinor: number;
}
export interface CheckoutResult {
    orderId: string;
    cartId: string;
    ownerId: string | null;
    currency: CurrencyCode;
    checkedOutAt: string;
    grossSubtotalMinor: number;
    totalDiscountMinor: number;
    netSubtotalMinor: number;
    totalTaxMinor: number;
    shippingMinor: number;
    grandTotalMinor: number;
    appliedPromotions: Array<{
        promotionId: string;
        name: string;
        discountMinor: number;
    }>;
    items: CheckoutLineReceipt[];
}
export declare class CartService {
    private readonly cartRepo;
    private readonly catalog;
    private readonly inventory;
    private readonly pricingEngine;
    private readonly promotionRegistry;
    private readonly eventBus;
    private readonly idempotencyStore?;
    private readonly defaultCurrency;
    private readonly defaultTtlMs;
    private readonly defaultLimits?;
    private readonly maxConcurrencyRetries;
    constructor(deps: {
        cartRepository: CartRepository;
        catalog: CatalogPort;
        inventory: InventoryPort;
        pricingEngine: PricingEngine;
        promotionRegistry: PromotionRegistry;
        eventBus: EventBusPort;
        idempotencyStore?: IdempotencyStore;
        config?: CartServiceConfig;
    });
    createCart(params?: {
        cartId?: string;
        ownerId?: string | null;
        currency?: CurrencyCode;
        ttlMs?: number | null;
        idempotencyKey?: string;
    }): Promise<Cart>;
    getCart(cartId: string): Promise<Cart>;
    getCartSummary(cartId: string, now?: Date): Promise<CartPricingSummary>;
    addItem(command: AddItemCommand): Promise<CartPricingSummary>;
    updateItemQuantity(command: UpdateQuantityCommand): Promise<CartPricingSummary>;
    removeItem(cartId: string, lineKey: string, expectedVersion?: number): Promise<CartPricingSummary>;
    clearCart(cartId: string, expectedVersion?: number): Promise<CartPricingSummary>;
    applyCoupon(cartId: string, code: string, expectedVersion?: number): Promise<CartPricingSummary>;
    removeCoupon(cartId: string, code: string, expectedVersion?: number): Promise<CartPricingSummary>;
    /**
     * Fusiona un carrito de invitado con el carrito activo del usuario autenticado.
     * Si el usuario no tenía carrito previo, le asigna el carrito de invitado.
     */
    mergeGuestCart(params: {
        guestCartId: string;
        userId: string;
    }): Promise<CartPricingSummary>;
    /**
     * Finaliza la compra con reserva atómica de inventario, compensación tipo Saga
     * ante conflicto de concurrencia e idempotencia para reintentos de red.
     */
    checkout(command: CheckoutCommand): Promise<CheckoutResult>;
    buildLineKey(productId: string, variantId?: string): string;
    private executeWithRetry;
}
//# sourceMappingURL=cart-service.d.ts.map