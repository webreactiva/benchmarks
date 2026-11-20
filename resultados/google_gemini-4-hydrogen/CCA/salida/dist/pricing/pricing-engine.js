import { Money } from '../domain/money.js';
/**
 * Orquesta el pipeline determinista de precios:
 * Subtotal bruto -> Promociones/Descuentos -> Prorrateo por línea -> Impuestos -> Envío -> Total final.
 */
export class PricingEngine {
    promotionRegistry;
    taxStrategy;
    shippingStrategy;
    constructor(params) {
        this.promotionRegistry = params.promotionRegistry;
        this.taxStrategy = params.taxStrategy;
        this.shippingStrategy = params.shippingStrategy;
    }
    calculate(cart, now = new Date()) {
        const currency = cart.currency;
        const grossSubtotal = cart.subtotal();
        const appliedPromotions = this.promotionRegistry.evaluateCart(cart, now);
        let totalDiscount = Money.zero(currency);
        const lineDiscountsAcc = new Map();
        for (const promo of appliedPromotions) {
            totalDiscount = totalDiscount.add(promo.discount);
            // Si la promoción especifica descuentos por línea, los acumulamos;
            // si es global (ej. FixedAmountDiscountRule), prorrateamos por subtotal de línea.
            const hasExplicitLines = Object.keys(promo.lineDiscounts).length > 0;
            if (hasExplicitLines) {
                for (const [lineKey, amount] of Object.entries(promo.lineDiscounts)) {
                    const prev = lineDiscountsAcc.get(lineKey) ?? Money.zero(currency);
                    lineDiscountsAcc.set(lineKey, prev.add(amount));
                }
            }
            else if (grossSubtotal.isPositive()) {
                let distributed = Money.zero(currency);
                const items = cart.items;
                items.forEach((item, index) => {
                    const share = index === items.length - 1
                        ? promo.discount.subtractClampedZero(distributed)
                        : Money.fromMinor(Math.floor((promo.discount.amountMinor * item.subtotal().amountMinor) /
                            grossSubtotal.amountMinor), currency);
                    const prev = lineDiscountsAcc.get(item.lineKey) ?? Money.zero(currency);
                    lineDiscountsAcc.set(item.lineKey, prev.add(share));
                    distributed = distributed.add(share);
                });
            }
        }
        totalDiscount = totalDiscount.min(grossSubtotal);
        const netSubtotal = grossSubtotal.subtractClampedZero(totalDiscount);
        const discountedLineTotals = new Map();
        const lines = cart.items.map((item) => {
            const gross = item.subtotal();
            const rawDiscount = lineDiscountsAcc.get(item.lineKey) ?? Money.zero(currency);
            const clampedDiscount = rawDiscount.min(gross);
            const net = gross.subtractClampedZero(clampedDiscount);
            discountedLineTotals.set(item.lineKey, net);
            return {
                lineKey: item.lineKey,
                productId: item.productId,
                ...(item.variantId !== undefined ? { variantId: item.variantId } : {}),
                sku: item.sku,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                grossSubtotal: gross,
                discount: clampedDiscount,
                netSubtotal: net,
            };
        });
        const tax = this.taxStrategy.calculate(cart, discountedLineTotals);
        const shipping = this.shippingStrategy.calculate(cart, netSubtotal);
        const grandTotal = netSubtotal.add(tax.totalTax).add(shipping.cost);
        return {
            cartId: cart.id,
            currency,
            version: cart.version,
            lines,
            grossSubtotal,
            totalDiscount,
            netSubtotal,
            appliedPromotions,
            tax,
            shipping,
            grandTotal,
        };
    }
}
//# sourceMappingURL=pricing-engine.js.map