import type { CouponDefinition, Promotion } from '../../domain/coupon.js';
import { money } from '../../domain/money.js';
import type { PricingRulesProvider } from '../../application/ports.js';

export const defaultPromotions: readonly Promotion[] = [
  {
    id: 'promo-welcome',
    type: 'percentage',
    value: 0.1,
    description: '10 % de descuento en tu primera compra',
    minSubtotal: money(5000, 'EUR'),
    maxDiscount: money(1500, 'EUR'),
    priority: 10,
  },
  {
    id: 'promo-free-shipping',
    type: 'free_shipping',
    value: 0,
    description: 'Envío gratis desde 50 €',
    minSubtotal: money(5000, 'EUR'),
    priority: 20,
  },
];

export const defaultCoupons: readonly CouponDefinition[] = [
  {
    code: 'BIENVENIDA10',
    type: 'percentage',
    value: 0.1,
    description: '10 % de descuento',
    maxDiscount: money(2000, 'EUR'),
    minSubtotal: money(2000, 'EUR'),
    active: true,
  },
  {
    code: 'ENVIOGRATIS',
    type: 'free_shipping',
    value: 0,
    description: 'Envío gratis',
    active: true,
  },
  {
    code: 'VERANO25',
    type: 'fixed_amount',
    value: money(2500, 'EUR').amount,
    description: '25 € de descuento',
    minSubtotal: money(10000, 'EUR'),
    active: true,
  },
];

export class InMemoryPricingRules implements PricingRulesProvider {
  constructor(
    private readonly promotions: readonly Promotion[] = defaultPromotions,
    private readonly coupons: readonly CouponDefinition[] = defaultCoupons,
  ) {}

  async getPromotions(): Promise<Promotion[]> {
    return [...this.promotions];
  }

  async getCoupon(code: string): Promise<CouponDefinition | null> {
    const normalized = code.trim().toUpperCase();
    return this.coupons.find((coupon) => coupon.code.toUpperCase() === normalized) ?? null;
  }
}
