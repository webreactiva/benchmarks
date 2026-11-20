import type { Cart } from '../domain/cart.js';
import type { TaxCategory } from '../domain/cart-item.js';
import { Money } from '../domain/money.js';

export interface TaxBreakdownLine {
  category: TaxCategory;
  ratePercent: number;
  taxableBase: Money;
  taxAmount: Money;
}

export interface TaxCalculationResult {
  totalTax: Money;
  breakdown: TaxBreakdownLine[];
}

export interface TaxStrategy {
  calculate(
    cart: Cart,
    discountedLineTotals: Map<string, Money>,
  ): TaxCalculationResult;
}

/**
 * Estrategia de impuestos por categoría fiscal (p. ej. IVA General 21%, Reducido 10%, Superreducido 4%, Exento 0%).
 */
export class CategoryTaxStrategy implements TaxStrategy {
  private readonly ratesByCategory: Record<TaxCategory, number>;

  constructor(ratesByCategory?: Partial<Record<TaxCategory, number>>) {
    this.ratesByCategory = {
      STANDARD: ratesByCategory?.STANDARD ?? 21,
      REDUCED: ratesByCategory?.REDUCED ?? 10,
      SUPER_REDUCED: ratesByCategory?.SUPER_REDUCED ?? 4,
      EXEMPT: ratesByCategory?.EXEMPT ?? 0,
    };
  }

  public calculate(
    cart: Cart,
    discountedLineTotals: Map<string, Money>,
  ): TaxCalculationResult {
    const baseByCategory = new Map<TaxCategory, Money>();

    for (const item of cart.items) {
      const lineTotal = discountedLineTotals.get(item.lineKey) ?? item.subtotal();
      const prev = baseByCategory.get(item.taxCategory) ?? Money.zero(cart.currency);
      baseByCategory.set(item.taxCategory, prev.add(lineTotal));
    }

    const breakdown: TaxBreakdownLine[] = [];
    let totalTax = Money.zero(cart.currency);

    for (const [category, taxableBase] of baseByCategory.entries()) {
      const ratePercent = this.ratesByCategory[category];
      const taxAmount = taxableBase.percentage(ratePercent);
      breakdown.push({
        category,
        ratePercent,
        taxableBase,
        taxAmount,
      });
      totalTax = totalTax.add(taxAmount);
    }

    return { totalTax, breakdown };
  }
}

/**
 * Estrategia simple sin impuestos (p. ej. B2B intracomunitario con inversión del sujeto pasivo).
 */
export class ZeroTaxStrategy implements TaxStrategy {
  public calculate(cart: Cart): TaxCalculationResult {
    return {
      totalTax: Money.zero(cart.currency),
      breakdown: [],
    };
  }
}
