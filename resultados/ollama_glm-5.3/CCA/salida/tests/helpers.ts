import { MemoryCartRepository } from '../src/adapters/memory/memory-cart-repository.js';
import { MemoryProductRepository } from '../src/adapters/memory/memory-product-repository.js';
import type { Product } from '../src/domain/product.js';
import type { CartRepository } from '../src/ports/repositories.js';
import { CartService } from '../src/services/cart-service.js';
import type { PricingConfig } from '../src/services/pricing-service.js';
import { PricingService } from '../src/services/pricing-service.js';

export const TEST_PRICING: PricingConfig = {
  taxRate: 0.21,
  shippingCents: 499,
  freeShippingThresholdCents: 5000,
  discounts: {
    DIEZ: { code: 'DIEZ', type: 'percent', value: 10 },
    CINCO: { code: 'CINCO', type: 'fixed', value: 500, minSubtotalCents: 2500 },
  },
};

/** SUT del carrito montado con los adaptadores en memoria: sin red, sin disco. */
export function buildService(catalog: Product[]) {
  const products = new MemoryProductRepository(catalog);
  const carts: CartRepository = new MemoryCartRepository();
  const pricing = new PricingService(TEST_PRICING);
  return { products, service: new CartService(carts, products, pricing) };
}
