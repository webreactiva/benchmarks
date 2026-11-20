import { Money, type MoneyJSON } from './money.js';
export type TaxCategory = 'STANDARD' | 'REDUCED' | 'SUPER_REDUCED' | 'EXEMPT';
export interface CartItemProps {
    productId: string;
    variantId?: string;
    sku: string;
    name: string;
    categoryId: string;
    taxCategory: TaxCategory;
    unitPrice: Money;
    quantity: number;
    weightGrams?: number;
    metadata?: Record<string, string | number | boolean>;
}
export interface CartItemSnapshot {
    lineKey: string;
    productId: string;
    variantId?: string;
    sku: string;
    name: string;
    categoryId: string;
    taxCategory: TaxCategory;
    unitPrice: MoneyJSON;
    quantity: number;
    weightGrams?: number;
    metadata?: Record<string, string | number | boolean>;
}
export declare function buildLineKey(productId: string, variantId?: string): string;
export declare function assertValidQuantity(quantity: number, maxQuantity?: number): void;
export declare class CartItem {
    readonly lineKey: string;
    readonly productId: string;
    readonly variantId?: string;
    readonly sku: string;
    readonly name: string;
    readonly categoryId: string;
    readonly taxCategory: TaxCategory;
    readonly unitPrice: Money;
    readonly quantity: number;
    readonly weightGrams: number;
    readonly metadata: Record<string, string | number | boolean>;
    constructor(props: CartItemProps);
    subtotal(): Money;
    totalWeightGrams(): number;
    withQuantity(newQuantity: number, maxQuantity?: number): CartItem;
    withUnitPrice(newUnitPrice: Money): CartItem;
    toSnapshot(): CartItemSnapshot;
    static fromSnapshot(snapshot: CartItemSnapshot): CartItem;
}
//# sourceMappingURL=cart-item.d.ts.map