import type { Coupon } from "../domain/catalog.js";
import type { CouponRepository } from "../application/ports.js";

export class InMemoryCouponRepository implements CouponRepository {
  private readonly coupons = new Map<string, Coupon>();

  constructor(seed: Coupon[] = []) {
    for (const coupon of seed) {
      this.coupons.set(coupon.code.toUpperCase(), { ...coupon });
    }
  }

  async getByCode(code: string): Promise<Coupon | null> {
    const coupon = this.coupons.get(code.trim().toUpperCase());
    return coupon ? { ...coupon } : null;
  }
}

export const SEED_COUPONS: Coupon[] = [
  {
    code: "WELCOME10",
    type: "percentage",
    value: 10,
    description: "10% de descuento en todo el pedido",
  },
  {
    code: "TECH50",
    type: "fixed",
    value: 5000,
    minSubtotalCents: 20000,
    description: "50€ de descuento en pedidos de más de 200€",
  },
  {
    code: "SAVE5",
    type: "fixed",
    value: 500,
    maxDiscountCents: 500,
    description: "5€ de descuento",
  },
];
