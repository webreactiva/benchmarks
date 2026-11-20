import type { Cart } from '../domain/cart.js';
import { Money } from '../domain/money.js';
export interface ShippingQuote {
    cost: Money;
    methodName: string;
    freeShippingApplied: boolean;
}
export interface ShippingStrategy {
    calculate(cart: Cart, netSubtotalAfterDiscounts: Money): ShippingQuote;
}
/**
 * Tarifa plana con umbral de envío gratuito (p. ej. 5.95 EUR, gratis desde 50 EUR).
 */
export declare class FreeThresholdShippingStrategy implements ShippingStrategy {
    private readonly flatRate;
    private readonly freeThreshold;
    private readonly methodName;
    constructor(params: {
        flatRate: Money;
        freeThreshold: Money;
        methodName?: string;
    });
    calculate(cart: Cart, netSubtotalAfterDiscounts: Money): ShippingQuote;
}
/**
 * Estrategia de envío calculado por peso total del carrito.
 */
export declare class WeightBasedShippingStrategy implements ShippingStrategy {
    private readonly baseRate;
    private readonly ratePerKg;
    private readonly methodName;
    constructor(params: {
        baseRate: Money;
        ratePerKg: Money;
        methodName?: string;
    });
    calculate(cart: Cart): ShippingQuote;
}
//# sourceMappingURL=shipping-strategy.d.ts.map