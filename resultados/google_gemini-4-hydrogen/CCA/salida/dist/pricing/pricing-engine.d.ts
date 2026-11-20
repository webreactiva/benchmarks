import type { Cart } from '../domain/cart.js';
import { Money } from '../domain/money.js';
import type { AppliedPromotion, PromotionRegistry } from '../promotions/promotion.js';
import type { ShippingQuote, ShippingStrategy } from './shipping-strategy.js';
import type { TaxCalculationResult, TaxStrategy } from './tax-strategy.js';
export interface PricedLineItem {
    lineKey: string;
    productId: string;
    variantId?: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: Money;
    grossSubtotal: Money;
    discount: Money;
    netSubtotal: Money;
}
export interface CartPricingSummary {
    cartId: string;
    currency: string;
    version: number;
    lines: PricedLineItem[];
    grossSubtotal: Money;
    totalDiscount: Money;
    netSubtotal: Money;
    appliedPromotions: AppliedPromotion[];
    tax: TaxCalculationResult;
    shipping: ShippingQuote;
    grandTotal: Money;
}
/**
 * Orquesta el pipeline determinista de precios:
 * Subtotal bruto -> Promociones/Descuentos -> Prorrateo por línea -> Impuestos -> Envío -> Total final.
 */
export declare class PricingEngine {
    private readonly promotionRegistry;
    private readonly taxStrategy;
    private readonly shippingStrategy;
    constructor(params: {
        promotionRegistry: PromotionRegistry;
        taxStrategy: TaxStrategy;
        shippingStrategy: ShippingStrategy;
    });
    calculate(cart: Cart, now?: Date): CartPricingSummary;
}
//# sourceMappingURL=pricing-engine.d.ts.map