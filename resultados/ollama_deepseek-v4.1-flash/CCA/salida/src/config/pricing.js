import { PricingEngine } from '../core/pricing/PricingEngine.js';
import {
  CouponRule,
  ShippingRule,
  TaxRule,
  VolumeDiscountRule,
} from '../core/pricing/rules.js';
import { coupons } from '../data/coupons.js';

export const shippingConfig = {
  freeThresholdCents: 5000,
  baseCents: 499,
};

export const taxConfig = {
  rate: 0.21,
  label: 'IVA (21 %)',
};

export function createDefaultPricing() {
  return new PricingEngine({
    rules: [
      VolumeDiscountRule({ minQty: 3, rate: 0.1 }),
      CouponRule({ coupons }),
      ShippingRule(shippingConfig),
      TaxRule(taxConfig),
    ],
  });
}
