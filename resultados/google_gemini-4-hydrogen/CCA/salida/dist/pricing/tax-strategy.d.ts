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
    calculate(cart: Cart, discountedLineTotals: Map<string, Money>): TaxCalculationResult;
}
/**
 * Estrategia de impuestos por categoría fiscal (p. ej. IVA General 21%, Reducido 10%, Superreducido 4%, Exento 0%).
 */
export declare class CategoryTaxStrategy implements TaxStrategy {
    private readonly ratesByCategory;
    constructor(ratesByCategory?: Partial<Record<TaxCategory, number>>);
    calculate(cart: Cart, discountedLineTotals: Map<string, Money>): TaxCalculationResult;
}
/**
 * Estrategia simple sin impuestos (p. ej. B2B intracomunitario con inversión del sujeto pasivo).
 */
export declare class ZeroTaxStrategy implements TaxStrategy {
    calculate(cart: Cart): TaxCalculationResult;
}
//# sourceMappingURL=tax-strategy.d.ts.map