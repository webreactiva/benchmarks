import { formatMoney } from '../money.js';

export function VolumeDiscountRule({ minQty = 3, rate = 0.1, label = 'Descuento por volumen' } = {}) {
  return {
    name: 'volume-discount',
    priority: 10,
    apply(context) {
      for (const item of context.items) {
        if (item.qty < minQty) {
          continue;
        }
        const lineTotal = item.priceCents * item.qty;
        context.addDiscount({
          label: `${label} · ${item.name}`,
          amountCents: Math.round(lineTotal * rate),
        });
      }
    },
  };
}

export function CouponRule({ coupons = [] } = {}) {
  return {
    name: 'coupon',
    priority: 20,
    apply(context) {
      if (!context.coupon) {
        return;
      }

      const coupon = coupons.find((entry) => entry.code === context.coupon.code) ?? context.coupon;
      const minSubtotal = coupon.minSubtotalCents ?? 0;

      if (context.subtotalCents < minSubtotal) {
        context.metadata.couponApplied = false;
        context.metadata.couponError =
          `El cupón ${coupon.code} requiere un mínimo de ${formatMoney(minSubtotal, { currency: context.currency })}.`;
        return;
      }

      const amount =
        coupon.type === 'percent'
          ? Math.round(context.discountedSubtotalCents * (Number(coupon.value) / 100))
          : Number(coupon.value);

      context.addDiscount({
        label: coupon.description ?? `Cupón ${coupon.code}`,
        amountCents: amount,
        code: coupon.code,
      });
      context.metadata.couponApplied = true;
      context.metadata.couponCode = coupon.code;
    },
  };
}

export function ShippingRule({ freeThresholdCents = 5000, baseCents = 499 } = {}) {
  return {
    name: 'shipping',
    priority: 30,
    apply(context) {
      if (context.items.length === 0) {
        context.shippingCents = 0;
        context.metadata.freeShippingReached = false;
        context.metadata.freeShippingRemainingCents = freeThresholdCents;
        context.metadata.freeShippingThresholdCents = freeThresholdCents;
        return;
      }

      const remaining = Math.max(0, freeThresholdCents - context.discountedSubtotalCents);
      context.shippingCents = remaining === 0 ? 0 : baseCents;
      context.metadata.freeShippingThresholdCents = freeThresholdCents;
      context.metadata.freeShippingRemainingCents = remaining;
      context.metadata.freeShippingReached = remaining === 0;
    },
  };
}

export function TaxRule({ rate = 0.21, label = 'IVA (21%)' } = {}) {
  return {
    name: 'tax',
    priority: 40,
    apply(context) {
      const taxable = context.discountedSubtotalCents + context.shippingCents;
      context.taxCents = Math.round(taxable * rate);
      context.metadata.taxRate = rate;
      context.metadata.taxLabel = label;
    },
  };
}
