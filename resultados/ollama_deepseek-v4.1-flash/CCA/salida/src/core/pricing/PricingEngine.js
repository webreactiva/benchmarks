export class PricingEngine {
  constructor({ rules = [] } = {}) {
    this.rules = [];
    for (const rule of rules) {
      this.register(rule);
    }
  }

  register(rule) {
    if (!rule || typeof rule.apply !== 'function') {
      throw new TypeError('La regla de precio debe implementar apply(context)');
    }
    this.rules.push(rule);
    this.rules.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    return this;
  }

  calculate(state = {}) {
    const items = state.items ?? [];
    const currency = state.currency ?? 'EUR';
    const subtotalCents = items.reduce(
      (sum, item) => sum + (Number(item.priceCents) || 0) * (Number(item.qty) || 0),
      0,
    );

    const context = {
      items,
      coupon: state.coupon ?? null,
      currency,
      subtotalCents,
      discountedSubtotalCents: subtotalCents,
      discountCents: 0,
      discounts: [],
      shippingCents: 0,
      taxCents: 0,
      totalCents: subtotalCents,
      metadata: {},
    };

    context.addDiscount = ({ label, amountCents, code = null }) => {
      const amount = Math.max(0, Math.round(Number(amountCents) || 0));
      if (amount === 0) {
        return;
      }
      const capped = Math.min(amount, context.discountedSubtotalCents);
      context.discounts.push({ label, amountCents: capped, code });
      context.discountCents += capped;
      context.discountedSubtotalCents -= capped;
    };

    for (const rule of this.rules) {
      rule.apply(context);
    }

    context.totalCents = Math.max(
      0,
      context.discountedSubtotalCents + context.shippingCents + context.taxCents,
    );

    return {
      itemCount: items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0),
      subtotalCents: context.subtotalCents,
      discountedSubtotalCents: context.discountedSubtotalCents,
      discountCents: context.discountCents,
      discounts: context.discounts,
      shippingCents: context.shippingCents,
      taxCents: context.taxCents,
      totalCents: context.totalCents,
      currency,
      ...context.metadata,
    };
  }
}
