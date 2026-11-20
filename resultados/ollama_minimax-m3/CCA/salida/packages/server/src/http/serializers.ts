import type { Cart, CartView, Money } from '@cart/core';

export interface MoneyDto {
  readonly amount: number;
  readonly currency: string;
}

export const serializeMoney = (value: Money): MoneyDto => ({
  amount: value.amount,
  currency: value.currency,
});

export const serializeCart = (cart: Cart) => ({
  id: cart.id,
  customerId: cart.customerId,
  status: cart.status,
  currency: cart.currency,
  version: cart.version,
  createdAt: cart.createdAt,
  updatedAt: cart.updatedAt,
  lines: cart.lines.map((line) => ({
    id: line.id,
    productId: line.productId,
    sku: line.sku,
    name: line.name,
    quantity: line.quantity,
    unitPrice: serializeMoney(line.unitPrice),
    lineTotal: serializeMoney({
      amount: line.unitPrice.amount * line.quantity,
      currency: line.unitPrice.currency,
    }),
    addedAt: line.addedAt,
    updatedAt: line.updatedAt,
    ...(line.metadata ? { metadata: line.metadata } : {}),
  })),
  coupons: cart.coupons.map((coupon) => ({
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    description: coupon.description,
    appliedAt: coupon.appliedAt,
    discountAmount: serializeMoney(coupon.discountAmount),
  })),
});

export const serializeCartView = (view: CartView) => ({
  cart: serializeCart(view.cart),
  totals: {
    currency: view.totals.currency,
    subtotal: serializeMoney(view.totals.subtotal),
    promotionDiscount: serializeMoney(view.totals.promotionDiscount),
    couponDiscount: serializeMoney(view.totals.couponDiscount),
    discountTotal: serializeMoney(view.totals.discountTotal),
    shipping: serializeMoney(view.totals.shipping),
    freeShipping: view.totals.freeShipping,
    taxableBase: serializeMoney(view.totals.taxableBase),
    tax: serializeMoney(view.totals.tax),
    total: serializeMoney(view.totals.total),
    unitCount: view.totals.unitCount,
    distinctItems: view.totals.distinctItems,
    items: view.totals.items.map((item) => ({
      lineId: item.lineId,
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPrice: serializeMoney(item.unitPrice),
      subtotal: serializeMoney(item.subtotal),
      discount: serializeMoney(item.discount),
      total: serializeMoney(item.total),
    })),
    appliedCoupons: view.totals.appliedCoupons.map((coupon) => ({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      description: coupon.description,
      appliedAt: coupon.appliedAt,
      discountAmount: serializeMoney(coupon.discountAmount),
    })),
    appliedPromotions: view.totals.appliedPromotions.map((promotion) => ({
      id: promotion.id,
      type: promotion.type,
      description: promotion.description,
    })),
  },
});

export const serializeCheckout = (result: {
  cart: Cart;
  totals: CartView['totals'];
  reservationId: string;
}) => ({
  ...serializeCartView(result),
  reservationId: result.reservationId,
});
