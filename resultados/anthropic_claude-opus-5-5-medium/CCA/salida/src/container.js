// Composición de dependencias. Es el ÚNICO sitio donde se decide qué
// implementación concreta usa cada puerto.

import { CartService } from './application/cartService.js';
import { InMemoryCartRepository } from './infrastructure/inMemoryCartRepository.js';
import { RedisCartRepository } from './infrastructure/redisCartRepository.js';
import {
  InMemoryCatalog,
  InMemoryCouponRepository,
  InMemoryEventBus,
  InMemoryIdempotencyStore,
} from './infrastructure/adapters.js';

// Datos de ejemplo (precios en céntimos, sin IVA).
export const SAMPLE_PRODUCTS = [
  { sku: 'CAMISETA-AZUL-M', name: 'Camiseta azul (M)', price: 1500, stock: 120 },
  { sku: 'TAZA-LOGO', name: 'Taza con logo', price: 800, stock: 40 },
  { sku: 'SUDADERA-GRIS-L', name: 'Sudadera gris (L)', price: 3500, stock: 15 },
  { sku: 'PEGATINAS', name: 'Pack de pegatinas', price: 300, stock: null }, // stock ilimitado
];

export const SAMPLE_COUPONS = {
  BIENVENIDA10: { type: 'percent_off_order', percent: 10, label: 'Bienvenida -10%' },
  MENOS5: { type: 'fixed_off_order', amount: 500, minSubtotal: 3000, label: '-5 € a partir de 30 €' },
  TAZAS3X2: { type: 'buy_x_pay_y', skus: ['TAZA-LOGO'], buy: 3, pay: 2, label: '3x2 en tazas' },
};

export const DEFAULT_PRICING = {
  rules: [],                                   // promociones automáticas (sin cupón)
  taxRate: 21,                                 // IVA %
  shipping: { flat: 499, freeOver: 5000 },     // 4,99 € — gratis desde 50 €
};

export async function buildContainer(env = process.env, overrides = {}) {
  let repository = overrides.repository;
  if (!repository && env.REDIS_URL) {
    // Import dinámico: ioredis solo es necesario si se usa Redis.
    const { default: Redis } = await import('ioredis');
    repository = new RedisCartRepository({ client: new Redis(env.REDIS_URL) });
  }
  repository ??= new InMemoryCartRepository();

  const catalog = overrides.catalog ?? new InMemoryCatalog(SAMPLE_PRODUCTS);
  const coupons = overrides.coupons ?? new InMemoryCouponRepository(SAMPLE_COUPONS);
  const eventBus = overrides.eventBus ?? new InMemoryEventBus();
  const idempotency = overrides.idempotency ?? new InMemoryIdempotencyStore();

  const service = new CartService({
    repository,
    catalog,
    coupons,
    eventBus,
    pricing: overrides.pricing ?? DEFAULT_PRICING,
    now: overrides.now,
  });

  return { service, repository, catalog, coupons, eventBus, idempotency };
}
