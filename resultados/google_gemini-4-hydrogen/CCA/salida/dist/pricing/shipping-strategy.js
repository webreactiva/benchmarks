import { Money } from '../domain/money.js';
/**
 * Tarifa plana con umbral de envío gratuito (p. ej. 5.95 EUR, gratis desde 50 EUR).
 */
export class FreeThresholdShippingStrategy {
    flatRate;
    freeThreshold;
    methodName;
    constructor(params) {
        params.flatRate.assertSameCurrency(params.freeThreshold);
        this.flatRate = params.flatRate;
        this.freeThreshold = params.freeThreshold;
        this.methodName = params.methodName ?? 'Envío estándar';
    }
    calculate(cart, netSubtotalAfterDiscounts) {
        if (cart.isEmpty()) {
            return {
                cost: Money.zero(cart.currency),
                methodName: this.methodName,
                freeShippingApplied: false,
            };
        }
        this.flatRate.assertSameCurrency(netSubtotalAfterDiscounts);
        if (netSubtotalAfterDiscounts.greaterThanOrEqual(this.freeThreshold)) {
            return {
                cost: Money.zero(cart.currency),
                methodName: this.methodName,
                freeShippingApplied: true,
            };
        }
        return {
            cost: this.flatRate,
            methodName: this.methodName,
            freeShippingApplied: false,
        };
    }
}
/**
 * Estrategia de envío calculado por peso total del carrito.
 */
export class WeightBasedShippingStrategy {
    baseRate;
    ratePerKg;
    methodName;
    constructor(params) {
        params.baseRate.assertSameCurrency(params.ratePerKg);
        this.baseRate = params.baseRate;
        this.ratePerKg = params.ratePerKg;
        this.methodName = params.methodName ?? 'Envío por peso';
    }
    calculate(cart) {
        if (cart.isEmpty()) {
            return {
                cost: Money.zero(cart.currency),
                methodName: this.methodName,
                freeShippingApplied: false,
            };
        }
        const totalKg = Math.ceil(cart.totalWeightGrams() / 1000);
        const variableCost = this.ratePerKg.multiply(totalKg);
        return {
            cost: this.baseRate.add(variableCost),
            methodName: this.methodName,
            freeShippingApplied: false,
        };
    }
}
//# sourceMappingURL=shipping-strategy.js.map