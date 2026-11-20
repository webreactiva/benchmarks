import { Money } from '../domain/money.js';
/**
 * Estrategia de impuestos por categoría fiscal (p. ej. IVA General 21%, Reducido 10%, Superreducido 4%, Exento 0%).
 */
export class CategoryTaxStrategy {
    ratesByCategory;
    constructor(ratesByCategory) {
        this.ratesByCategory = {
            STANDARD: ratesByCategory?.STANDARD ?? 21,
            REDUCED: ratesByCategory?.REDUCED ?? 10,
            SUPER_REDUCED: ratesByCategory?.SUPER_REDUCED ?? 4,
            EXEMPT: ratesByCategory?.EXEMPT ?? 0,
        };
    }
    calculate(cart, discountedLineTotals) {
        const baseByCategory = new Map();
        for (const item of cart.items) {
            const lineTotal = discountedLineTotals.get(item.lineKey) ?? item.subtotal();
            const prev = baseByCategory.get(item.taxCategory) ?? Money.zero(cart.currency);
            baseByCategory.set(item.taxCategory, prev.add(lineTotal));
        }
        const breakdown = [];
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
export class ZeroTaxStrategy {
    calculate(cart) {
        return {
            totalTax: Money.zero(cart.currency),
            breakdown: [],
        };
    }
}
//# sourceMappingURL=tax-strategy.js.map