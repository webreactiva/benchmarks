import { CartService } from "./application/cart-service.ts";
import {
  BulkTierDiscountRule,
  BuyXGetYRule,
  FixedAmountDiscountRule,
  FreeShippingCouponRule,
  PercentageDiscountRule,
  PricingEngine,
  RegionalTaxCalculator,
  ThresholdShippingCalculator,
} from "./domain/pricing.ts";
import { FileCartRepository } from "./infrastructure/file-cart-repository.ts";
import { InMemoryCartRepository } from "./infrastructure/in-memory-cart-repository.ts";
import {
  createSampleCatalog,
  type InMemoryCatalogProvider,
} from "./infrastructure/in-memory-catalog.ts";
import { InMemoryEventBus } from "./infrastructure/in-memory-event-bus.ts";
import { InMemoryIdempotencyStore } from "./infrastructure/in-memory-idempotency-store.ts";
import { InMemoryInventoryProvider } from "./infrastructure/in-memory-inventory.ts";
import { InMemoryLockManager } from "./infrastructure/in-memory-lock-manager.ts";
import type { CartRepository } from "./ports/cart-repository.ts";

export interface CartSystemOptions {
  storageMode?: "memory" | "file";
  storageFilePath?: string;
}

export interface CartSystem {
  readonly cartService: CartService;
  readonly repository: CartRepository;
  readonly catalog: InMemoryCatalogProvider;
  readonly inventory: InMemoryInventoryProvider;
  readonly pricingEngine: PricingEngine;
  readonly eventBus: InMemoryEventBus;
}

export function createDefaultPricingEngine(): PricingEngine {
  return new PricingEngine({
    rules: [
      new BuyXGetYRule({
        id: "bogo-apparel",
        description: "3x2 en ropa (lleva 3, paga 2)",
        buyQuantity: 2,
        freeQuantity: 1,
        targetCategories: ["apparel"],
        priority: 10,
      }),
      new BulkTierDiscountRule({
        id: "bulk-accessories",
        description: "Descuento por volumen en accesorios (3+: 10%, 5+: 15%)",
        tiers: [
          { minQuantity: 3, percentOff: 10 },
          { minQuantity: 5, percentOff: 15 },
        ],
        eligibleCategories: ["accessories"],
        priority: 15,
      }),
      new PercentageDiscountRule({
        id: "welcome-10",
        description: "10% de descuento con cupón WELCOME10 (máx. 100 EUR)",
        percent: 10,
        couponCode: "WELCOME10",
        minSubtotalMinor: 3000,
        maxDiscountMinor: 10000,
        priority: 25,
      }),
      new FixedAmountDiscountRule({
        id: "save-20-eur",
        description: "20 EUR de descuento en pedidos de 100 EUR o más",
        amountMinor: 2000,
        currency: "EUR",
        couponCode: "SAVE20",
        minSubtotalMinor: 10000,
        priority: 30,
      }),
      new FreeShippingCouponRule({
        id: "free-shipping",
        description: "Envío gratis con cupón FREESHIP",
        couponCode: "FREESHIP",
        priority: 50,
      }),
    ],
    taxCalculator: new RegionalTaxCalculator({ ES: 0.21, FR: 0.2, DE: 0.19, US: 0.08 }),
    shippingCalculator: new ThresholdShippingCalculator({
      flatRateMinor: 499,
      freeShippingThresholdMinor: 5000,
    }),
  });
}

export function createDefaultCartSystem(options: CartSystemOptions = {}): CartSystem {
  const repository: CartRepository =
    options.storageMode === "file"
      ? new FileCartRepository(options.storageFilePath ?? "./data/carts.json")
      : new InMemoryCartRepository();

  const catalog = createSampleCatalog();
  const inventory = new InMemoryInventoryProvider({
    "LAPTOP-PRO-15": 15,
    "MOUSE-ERGO-01": 100,
    "KEYB-MECH-87": 50,
    "COFFEE-BEAN-1KG": 200,
    "TSHIRT-DEV-M": 80,
  });

  const pricingEngine = createDefaultPricingEngine();
  const eventBus = new InMemoryEventBus();
  const idempotencyStore = new InMemoryIdempotencyStore();
  const lockManager = new InMemoryLockManager();

  const cartService = new CartService({
    repository,
    catalog,
    inventory,
    pricingEngine,
    eventBus,
    idempotencyStore,
    lockManager,
  });

  return {
    cartService,
    repository,
    catalog,
    inventory,
    pricingEngine,
    eventBus,
  };
}
