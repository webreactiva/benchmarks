// Domain exports
export { Cart, DEFAULT_CART_LIMITS } from "./domain/cart.ts";
export type {
  AddCartItemInput,
  CartItemSnapshot,
  CartLimits,
  CartSnapshot,
  CartStatus,
  CreateCartInput,
} from "./domain/cart.ts";
export {
  CartLimitExceededError,
  CartNotFoundError,
  ConcurrencyConflictError,
  CurrencyMismatchError,
  DomainError,
  IdempotencyConflictError,
  InsufficientStockError,
  InvalidCartStateError,
  InvalidCouponError,
  LockTimeoutError,
  ProductNotFoundError,
  ValidationError,
} from "./domain/errors.ts";
export type { DomainErrorCode } from "./domain/errors.ts";
export type {
  CartCheckedOutEvent,
  CartClearedEvent,
  CartCouponAppliedEvent,
  CartCouponRemovedEvent,
  CartCreatedEvent,
  CartDomainEvent,
  CartExpiredEvent,
  CartItemAddedEvent,
  CartItemQuantityUpdatedEvent,
  CartItemRemovedEvent,
  CartMergedEvent,
} from "./domain/events.ts";
export { Money } from "./domain/money.ts";
export type { MoneyJSON } from "./domain/money.ts";
export {
  BulkTierDiscountRule,
  BuyXGetYRule,
  FixedAmountDiscountRule,
  FreeShippingCouponRule,
  PercentageDiscountRule,
  PricingEngine,
  RegionalTaxCalculator,
  ThresholdShippingCalculator,
} from "./domain/pricing.ts";
export type {
  AppliedPromotion,
  CartPriceSummary,
  PricedLineItem,
  PromotionEvaluationContext,
  PromotionResult,
  PromotionRule,
  ShippingCalculator,
  TaxCalculator,
} from "./domain/pricing.ts";

// Ports exports
export type { CartRepository } from "./ports/cart-repository.ts";
export type { CatalogProduct, CatalogProvider } from "./ports/catalog-provider.ts";
export type { EventBus, EventHandler } from "./ports/event-bus.ts";
export type { IdempotencyRecord, IdempotencyStore } from "./ports/idempotency-store.ts";
export type {
  InventoryProvider,
  StockItemRequest,
  StockReservation,
} from "./ports/inventory-provider.ts";
export type { LockManager } from "./ports/lock-manager.ts";

// Application exports
export { CartService } from "./application/cart-service.ts";
export type {
  AddItemCommand,
  CartServiceDependencies,
  CartView,
  CheckoutCommand,
  CheckoutResult,
  CommandOptions,
  CouponCommand,
  CreateCartCommand,
  MergeCartsCommand,
  RemoveItemCommand,
  UpdateItemQuantityCommand,
} from "./application/cart-service.ts";

// Infrastructure exports
export { FileCartRepository } from "./infrastructure/file-cart-repository.ts";
export { InMemoryCartRepository } from "./infrastructure/in-memory-cart-repository.ts";
export {
  createSampleCatalog,
  InMemoryCatalogProvider,
} from "./infrastructure/in-memory-catalog.ts";
export { InMemoryEventBus } from "./infrastructure/in-memory-event-bus.ts";
export { InMemoryIdempotencyStore } from "./infrastructure/in-memory-idempotency-store.ts";
export { InMemoryInventoryProvider } from "./infrastructure/in-memory-inventory.ts";
export { InMemoryLockManager } from "./infrastructure/in-memory-lock-manager.ts";

// API & Bootstrap exports
export { createCartHttpServer } from "./api/server.ts";
export { createDefaultCartSystem, createDefaultPricingEngine } from "./bootstrap.ts";
export type { CartSystem, CartSystemOptions } from "./bootstrap.ts";
