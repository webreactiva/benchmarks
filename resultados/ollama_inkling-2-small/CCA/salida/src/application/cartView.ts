import type { Cart } from "../domain/cart.js";
import type { Totals } from "../domain/pricing.js";

export interface CartView {
  id: string;
  ownerId: string | null;
  items: Array<{
    productId: string;
    name: string;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }>;
  couponCode: string | null;
  totals: Totals;
  version: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export function toCartView(cart: Cart, totals: Totals): CartView {
  return {
    id: cart.id,
    ownerId: cart.ownerId,
    items: cart.items.map((item) => ({
      ...item,
      lineTotalCents: item.unitPriceCents * item.quantity,
    })),
    couponCode: cart.couponCode,
    totals,
    version: cart.version,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    expiresAt: cart.expiresAt,
  };
}
