import { CartItem, type CartItemProps, type CartItemSnapshot } from './cart-item.js';
import { type CartEvent } from './events.js';
import { Money, type CurrencyCode } from './money.js';
export type CartStatus = 'ACTIVE' | 'CHECKED_OUT' | 'EXPIRED' | 'MERGED';
export interface CartLimits {
    maxLineItems: number;
    maxQuantityPerLine: number;
}
export interface CreateCartOptions {
    id: string;
    ownerId?: string | null;
    currency: CurrencyCode;
    ttlMs?: number | null;
    limits?: Partial<CartLimits>;
    now?: Date;
}
export interface CartSnapshot {
    id: string;
    ownerId: string | null;
    currency: CurrencyCode;
    status: CartStatus;
    version: number;
    items: CartItemSnapshot[];
    couponCodes: string[];
    createdAt: string;
    updatedAt: string;
    expiresAt: string | null;
    limits: CartLimits;
}
/**
 * Aggregate Root: Cart
 * Encapsula invariantes de negocio, control de concurrencia optimista (`version`)
 * y emisión de eventos de dominio.
 */
export declare class Cart {
    readonly id: string;
    private _ownerId;
    readonly currency: CurrencyCode;
    private _status;
    private _version;
    private readonly _items;
    private readonly _couponCodes;
    readonly createdAt: Date;
    private _updatedAt;
    private _expiresAt;
    readonly limits: CartLimits;
    private _domainEvents;
    private constructor();
    static create(options: CreateCartOptions): Cart;
    static fromSnapshot(snapshot: CartSnapshot): Cart;
    get ownerId(): string | null;
    get status(): CartStatus;
    get version(): number;
    get updatedAt(): Date;
    get expiresAt(): Date | null;
    get items(): ReadonlyArray<CartItem>;
    get couponCodes(): ReadonlyArray<string>;
    get lineCount(): number;
    get totalQuantity(): number;
    isEmpty(): boolean;
    isExpired(now?: Date): boolean;
    getItem(productId: string, variantId?: string): CartItem | undefined;
    getItemByLineKey(lineKey: string): CartItem | undefined;
    subtotal(): Money;
    totalWeightGrams(): number;
    private assertActive;
    private touch;
    addItem(props: CartItemProps, options?: {
        now?: Date;
        extendTtlMs?: number;
    }): CartItem;
    updateItemQuantity(lineKey: string, newQuantity: number, options?: {
        now?: Date;
        extendTtlMs?: number;
    }): CartItem | null;
    removeItem(lineKey: string, options?: {
        now?: Date;
        extendTtlMs?: number;
    }): boolean;
    clear(options?: {
        now?: Date;
    }): void;
    applyCoupon(code: string, options?: {
        now?: Date;
    }): boolean;
    removeCoupon(code: string, options?: {
        now?: Date;
    }): boolean;
    assignOwner(ownerId: string, now?: Date): void;
    /**
     * Fusiona los ítems y cupones de otro carrito (por ejemplo, de sesión invitada)
     * dentro de este carrito, marcando el carrito origen como MERGED.
     */
    mergeFrom(source: Cart, now?: Date): number;
    markCheckedOut(now?: Date): void;
    markExpired(now?: Date): void;
    pullDomainEvents(): CartEvent[];
    toSnapshot(): CartSnapshot;
}
//# sourceMappingURL=cart.d.ts.map