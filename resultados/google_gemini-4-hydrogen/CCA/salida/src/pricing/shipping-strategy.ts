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
export class FreeThresholdShippingStrategy implements ShippingStrategy {
  private readonly flatRate: Money;
  private readonly freeThreshold: Money;
  private readonly methodName: string;

  constructor(params: {
    flatRate: Money;
    freeThreshold: Money;
    methodName?: string;
  }) {
    params.flatRate.assertSameCurrency(params.freeThreshold);
    this.flatRate = params.flatRate;
    this.freeThreshold = params.freeThreshold;
    this.methodName = params.methodName ?? 'Envío estándar';
  }

  public calculate(cart: Cart, netSubtotalAfterDiscounts: Money): ShippingQuote {
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
export class WeightBasedShippingStrategy implements ShippingStrategy {
  private readonly baseRate: Money;
  private readonly ratePerKg: Money;
  private readonly methodName: string;

  constructor(params: { baseRate: Money; ratePerKg: Money; methodName?: string }) {
    params.baseRate.assertSameCurrency(params.ratePerKg);
    this.baseRate = params.baseRate;
    this.ratePerKg = params.ratePerKg;
    this.methodName = params.methodName ?? 'Envío por peso';
  }

  public calculate(cart: Cart): ShippingQuote {
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
