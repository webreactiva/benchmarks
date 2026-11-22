import { randomUUID } from "node:crypto";
import {
  Cart,
  DEFAULT_CART_LIMITS,
  type CartLimits,
  type CartSnapshot,
} from "../domain/cart.ts";
import {
  CartNotFoundError,
  ConcurrencyConflictError,
  InsufficientStockError,
  ProductNotFoundError,
  ValidationError,
} from "../domain/errors.ts";
import type { CartDomainEvent } from "../domain/events.ts";
import { Money } from "../domain/money.ts";
import { PricingEngine, type CartPriceSummary } from "../domain/pricing.ts";
import type { CartRepository } from "../ports/cart-repository.ts";
import type { CatalogProvider } from "../ports/catalog-provider.ts";
import type { EventBus } from "../ports/event-bus.ts";
import type { IdempotencyStore } from "../ports/idempotency-store.ts";
import type { InventoryProvider } from "../ports/inventory-provider.ts";
import type { LockManager } from "../ports/lock-manager.ts";

export interface CartView {
  readonly cart: CartSnapshot;
  readonly pricing: CartPriceSummary;
}

export interface CommandOptions {
  readonly idempotencyKey?: string;
  /** Optional explicit optimistic lock version (e.g. from HTTP If-Match). */
  readonly expectedVersion?: number;
}

export interface CreateCartCommand {
  readonly ownerId?: string | null;
  readonly currency?: string;
  readonly shippingRegion?: string;
  readonly ttlMs?: number;
  readonly metadata?: Record<string, string>;
  readonly idempotencyKey?: string;
}

export interface AddItemCommand extends CommandOptions {
  readonly cartId: string;
  readonly sku: string;
  readonly quantity: number;
  readonly metadata?: Record<string, string>;
}

export interface UpdateItemQuantityCommand extends CommandOptions {
  readonly cartId: string;
  readonly sku: string;
  readonly quantity: number;
}

export interface RemoveItemCommand extends CommandOptions {
  readonly cartId: string;
  readonly sku: string;
}

export interface CouponCommand extends CommandOptions {
  readonly cartId: string;
  readonly code: string;
}

export interface MergeCartsCommand {
  readonly sourceCartId: string;
  readonly targetCartId: string;
  readonly idempotencyKey?: string;
}

export interface CheckoutCommand extends CommandOptions {
  readonly cartId: string;
  readonly commitInventoryImmediately?: boolean;
}

export interface CheckoutResult {
  readonly orderId: string;
  readonly reservationId: string;
  readonly cart: CartSnapshot;
  readonly pricing: CartPriceSummary;
  readonly checkedOutAt: string;
}

export interface CartServiceDependencies {
  readonly repository: CartRepository;
  readonly catalog: CatalogProvider;
  readonly inventory: InventoryProvider;
  readonly pricingEngine: PricingEngine;
  readonly eventBus: EventBus;
  readonly idempotencyStore: IdempotencyStore;
  readonly lockManager: LockManager;
  readonly limits?: CartLimits;
  readonly maxOptimisticRetries?: number;
  readonly idempotencyTtlMs?: number;
  readonly clock?: () => Date;
}

export class CartService {
  private readonly repository: CartRepository;
  private readonly catalog: CatalogProvider;
  private readonly inventory: InventoryProvider;
  private readonly pricingEngine: PricingEngine;
  private readonly eventBus: EventBus;
  private readonly idempotencyStore: IdempotencyStore;
  private readonly lockManager: LockManager;
  private readonly limits: CartLimits;
  private readonly maxOptimisticRetries: number;
  private readonly idempotencyTtlMs: number;
  private readonly clock: () => Date;

  constructor(deps: CartServiceDependencies) {
    this.repository = deps.repository;
    this.catalog = deps.catalog;
    this.inventory = deps.inventory;
    this.pricingEngine = deps.pricingEngine;
    this.eventBus = deps.eventBus;
    this.idempotencyStore = deps.idempotencyStore;
    this.lockManager = deps.lockManager;
    this.limits = deps.limits ?? DEFAULT_CART_LIMITS;
    this.maxOptimisticRetries = deps.maxOptimisticRetries ?? 3;
    this.idempotencyTtlMs = deps.idempotencyTtlMs ?? 24 * 60 * 60 * 1000;
    this.clock = deps.clock ?? (() => new Date());
  }

  async createCart(cmd: CreateCartCommand = {}): Promise<CartView> {
    return this.withOptionalIdempotency(
      cmd.idempotencyKey,
      `createCart:${JSON.stringify({
        ownerId: cmd.ownerId ?? null,
        currency: cmd.currency ?? "EUR",
        shippingRegion: cmd.shippingRegion ?? "ES",
        metadata: cmd.metadata ?? {},
      })}`,
      async () => {
        const now = this.clock();
        const cart = Cart.create(
          {
            ownerId: cmd.ownerId,
            currency: cmd.currency,
            shippingRegion: cmd.shippingRegion,
            ttlMs: cmd.ttlMs,
            metadata: cmd.metadata,
            now,
          },
          this.limits,
        );

        await this.repository.save(cart.toSnapshot(), 0);
        await this.publishPending(cart);
        return this.buildView(cart, now);
      },
    );
  }

  async getOrCreateOwnerCart(
    ownerId: string,
    defaults: Omit<CreateCartCommand, "ownerId"> = {},
  ): Promise<CartView> {
    const trimmedOwner = ownerId.trim();
    if (!trimmedOwner) {
      throw new ValidationError("ownerId must be a non-empty string");
    }

    return this.lockManager.withLock(`owner:${trimmedOwner}`, async () => {
      const existing = await this.repository.findActiveByOwner(trimmedOwner);
      const now = this.clock();
      if (existing) {
        const cart = Cart.fromSnapshot(existing, this.limits);
        if (!cart.isExpired(now)) {
          return this.buildView(cart, now);
        }
      }
      return this.createCart({ ...defaults, ownerId: trimmedOwner });
    });
  }

  async getCart(cartId: string, options: { refreshPrices?: boolean } = {}): Promise<CartView> {
    const now = this.clock();
    if (!options.refreshPrices) {
      const cart = await this.loadCartOrThrow(cartId);
      return this.buildView(cart, now);
    }

    return this.mutateCart(cartId, undefined, async (cart) => {
      if (cart.status === "ACTIVE" && !cart.isExpired(now) && cart.items.length > 0) {
        await this.syncCatalogPrices(cart, now);
      }
    });
  }

  async addItem(cmd: AddItemCommand): Promise<CartView> {
    return this.withOptionalIdempotency(
      cmd.idempotencyKey,
      `addItem:${cmd.cartId}:${cmd.sku}:${cmd.quantity}:${JSON.stringify(cmd.metadata ?? {})}`,
      async () => {
        const product = await this.catalog.getProduct(cmd.sku);
        if (!product) {
          throw new ProductNotFoundError(cmd.sku);
        }

        return this.mutateCart(cmd.cartId, cmd.expectedVersion, async (cart, now) => {
          const existingQty = cart.getItem(cmd.sku)?.quantity ?? 0;
          const desiredQty = existingQty + cmd.quantity;
          const available = await this.inventory.getAvailableStock(cmd.sku);
          if (available < desiredQty) {
            throw new InsufficientStockError(cmd.sku, desiredQty, available);
          }

          cart.addItem({
            sku: product.sku,
            name: product.name,
            category: product.category,
            unitPrice: product.price,
            quantity: cmd.quantity,
            taxExempt: product.taxExempt,
            metadata: cmd.metadata,
            now,
          });
        });
      },
    );
  }

  async updateItemQuantity(cmd: UpdateItemQuantityCommand): Promise<CartView> {
    return this.withOptionalIdempotency(
      cmd.idempotencyKey,
      `updateQty:${cmd.cartId}:${cmd.sku}:${cmd.quantity}`,
      async () => {
        return this.mutateCart(cmd.cartId, cmd.expectedVersion, async (cart, now) => {
          if (cmd.quantity > 0) {
            const available = await this.inventory.getAvailableStock(cmd.sku);
            if (available < cmd.quantity) {
              throw new InsufficientStockError(cmd.sku, cmd.quantity, available);
            }
          }
          cart.updateItemQuantity(cmd.sku, cmd.quantity, now);
        });
      },
    );
  }

  async removeItem(cmd: RemoveItemCommand): Promise<CartView> {
    return this.withOptionalIdempotency(
      cmd.idempotencyKey,
      `removeItem:${cmd.cartId}:${cmd.sku}`,
      async () => {
        return this.mutateCart(cmd.cartId, cmd.expectedVersion, async (cart, now) => {
          cart.removeItem(cmd.sku, now);
        });
      },
    );
  }

  async clearCart(cartId: string, options: CommandOptions = {}): Promise<CartView> {
    return this.withOptionalIdempotency(
      options.idempotencyKey,
      `clearCart:${cartId}`,
      async () => {
        return this.mutateCart(cartId, options.expectedVersion, async (cart, now) => {
          cart.clear(now);
        });
      },
    );
  }

  async applyCoupon(cmd: CouponCommand): Promise<CartView> {
    return this.withOptionalIdempotency(
      cmd.idempotencyKey,
      `applyCoupon:${cmd.cartId}:${cmd.code.trim().toUpperCase()}`,
      async () => {
        this.pricingEngine.validateCouponExists(cmd.code);
        return this.mutateCart(cmd.cartId, cmd.expectedVersion, async (cart, now) => {
          cart.applyCoupon(cmd.code, now);
        });
      },
    );
  }

  async removeCoupon(cmd: CouponCommand): Promise<CartView> {
    return this.withOptionalIdempotency(
      cmd.idempotencyKey,
      `removeCoupon:${cmd.cartId}:${cmd.code.trim().toUpperCase()}`,
      async () => {
        return this.mutateCart(cmd.cartId, cmd.expectedVersion, async (cart, now) => {
          cart.removeCoupon(cmd.code, now);
        });
      },
    );
  }

  async setShippingRegion(
    cartId: string,
    shippingRegion: string,
    options: CommandOptions = {},
  ): Promise<CartView> {
    return this.mutateCart(cartId, options.expectedVersion, async (cart, now) => {
      cart.setShippingRegion(shippingRegion, now);
    });
  }

  /**
   * Merges a guest cart into a target (e.g. authenticated user) cart.
   * Acquires locks in lexicographic order to eliminate deadlock risk under concurrent merges.
   */
  async mergeCarts(cmd: MergeCartsCommand): Promise<CartView> {
    if (cmd.sourceCartId === cmd.targetCartId) {
      throw new ValidationError("sourceCartId and targetCartId must be different");
    }

    return this.withOptionalIdempotency(
      cmd.idempotencyKey,
      `merge:${cmd.sourceCartId}->${cmd.targetCartId}`,
      async () => {
        const [firstId, secondId] = [cmd.sourceCartId, cmd.targetCartId].sort();
        return this.lockManager.withLock(`cart:${firstId}`, async () =>
          this.lockManager.withLock(`cart:${secondId}`, async () => {
            const now = this.clock();
            const source = await this.loadCartOrThrow(cmd.sourceCartId);
            const target = await this.loadCartOrThrow(cmd.targetCartId);

            const sourceExpectedVersion = source.version;
            const targetExpectedVersion = target.version;

            // Validate inventory in batch for combined quantities
            const combinedSkus = new Set<string>([
              ...source.items.map((i) => i.sku),
              ...target.items.map((i) => i.sku),
            ]);
            const stockMap = await this.inventory.getAvailableStockBatch(Array.from(combinedSkus));
            for (const srcItem of source.items) {
              const targetQty = target.getItem(srcItem.sku)?.quantity ?? 0;
              const desired = Math.min(this.limits.maxQuantityPerItem, targetQty + srcItem.quantity);
              const available = stockMap.get(srcItem.sku) ?? 0;
              if (available < desired) {
                throw new InsufficientStockError(srcItem.sku, desired, available);
              }
            }

            target.mergeFrom(source, now);

            // Persist target first, then source (if target fails, source remains untouched)
            await this.repository.save(target.toSnapshot(), targetExpectedVersion);
            await this.repository.save(source.toSnapshot(), sourceExpectedVersion);

            await this.publishPending(target);
            await this.publishPending(source);
            return this.buildView(target, now);
          }),
        );
      },
    );
  }

  /**
   * Executes cart checkout:
   * 1. Refreshes authoritative catalog prices in a single batch call.
   * 2. Atomically reserves inventory for all cart items.
   * 3. Computes final price summary.
   * 4. Marks cart CHECKED_OUT and persists with optimistic lock.
   * 5. Compensates (releases stock reservation) if persistence fails.
   */
  async checkout(cmd: CheckoutCommand): Promise<CheckoutResult> {
    return this.withOptionalIdempotency(
      cmd.idempotencyKey,
      `checkout:${cmd.cartId}:${cmd.commitInventoryImmediately ?? true}`,
      async () => {
        return this.lockManager.withLock(`cart:${cmd.cartId}`, async () => {
          const now = this.clock();
          const cart = await this.loadCartOrThrow(cmd.cartId);

          if (cmd.expectedVersion !== undefined && cart.version !== cmd.expectedVersion) {
            throw new ConcurrencyConflictError(cmd.cartId, cmd.expectedVersion, cart.version);
          }

          if (cart.items.length === 0) {
            throw new ValidationError("Cannot checkout an empty cart");
          }

          const persistedVersion = cart.version;

          // Refresh catalog prices in batch & verify all SKUs are still active
          await this.syncCatalogPrices(cart, now, { requireAllActive: true });

          const pricing = this.pricingEngine.calculate(cart, now);
          const grandTotal = Money.ofMinor(pricing.grandTotal.amountMinor, pricing.currency);

          const stockRequest = cart.items.map((item) => ({
            sku: item.sku,
            quantity: item.quantity,
          }));

          const reservation = await this.inventory.reserve(cart.id, stockRequest);
          const orderId = `ord_${randomUUID()}`;

          try {
            cart.markCheckedOut(orderId, reservation.reservationId, grandTotal, now);
            await this.repository.save(cart.toSnapshot(), persistedVersion);
          } catch (error) {
            // Saga compensation: release reserved stock if cart save fails
            await this.inventory.releaseReservation(reservation.reservationId);
            throw error;
          }

          if (cmd.commitInventoryImmediately !== false) {
            await this.inventory.commitReservation(reservation.reservationId);
          }

          await this.publishPending(cart);

          return {
            orderId,
            reservationId: reservation.reservationId,
            cart: cart.toSnapshot(),
            pricing,
            checkedOutAt: now.toISOString(),
          };
        });
      },
    );
  }

  /**
   * Background housekeeping job: expires stale active carts and emits CartExpired events.
   */
  async purgeExpiredCarts(): Promise<number> {
    const now = this.clock();
    const expiredSnapshots = await this.repository.purgeExpired(now);
    const events: CartDomainEvent[] = expiredSnapshots.map((snapshot) => ({
      eventId: randomUUID(),
      type: "CartExpired",
      cartId: snapshot.id,
      cartVersion: snapshot.version,
      occurredAt: now.toISOString(),
      payload: { expiredAt: snapshot.expiresAt },
    }));
    if (events.length > 0) {
      await this.eventBus.publish(events);
    }
    return expiredSnapshots.length;
  }

  private async mutateCart(
    cartId: string,
    explicitExpectedVersion: number | undefined,
    mutator: (cart: Cart, now: Date) => Promise<void> | void,
  ): Promise<CartView> {
    return this.lockManager.withLock(`cart:${cartId}`, async () => {
      const maxAttempts = explicitExpectedVersion !== undefined ? 1 : this.maxOptimisticRetries;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const now = this.clock();
        const cart = await this.loadCartOrThrow(cartId);
        const loadedVersion = cart.version;

        if (explicitExpectedVersion !== undefined && loadedVersion !== explicitExpectedVersion) {
          throw new ConcurrencyConflictError(cartId, explicitExpectedVersion, loadedVersion);
        }

        await mutator(cart, now);

        // Skip repository write if nothing mutated the aggregate
        if (cart.version === loadedVersion) {
          return this.buildView(cart, now);
        }

        try {
          await this.repository.save(cart.toSnapshot(), loadedVersion);
          await this.publishPending(cart);
          return this.buildView(cart, now);
        } catch (error) {
          if (error instanceof ConcurrencyConflictError && attempt < maxAttempts) {
            continue;
          }
          throw error;
        }
      }

      throw new ConcurrencyConflictError(cartId, -1, -1);
    });
  }

  private async syncCatalogPrices(
    cart: Cart,
    now: Date,
    options: { requireAllActive?: boolean } = {},
  ): Promise<void> {
    const skus = cart.items.map((i) => i.sku);
    if (skus.length === 0) return;

    const products = await this.catalog.getProducts(skus);
    for (const sku of skus) {
      const product = products.get(sku);
      if (!product) {
        if (options.requireAllActive) {
          throw new ProductNotFoundError(sku);
        }
        continue;
      }
      cart.refreshItemPrice(
        sku,
        {
          name: product.name,
          category: product.category,
          unitPrice: product.price,
          taxExempt: product.taxExempt,
        },
        now,
      );
    }
  }

  private async loadCartOrThrow(cartId: string): Promise<Cart> {
    const snapshot = await this.repository.findById(cartId);
    if (!snapshot) {
      throw new CartNotFoundError(cartId);
    }
    return Cart.fromSnapshot(snapshot, this.limits);
  }

  private buildView(cart: Cart, now: Date): CartView {
    return {
      cart: cart.toSnapshot(),
      pricing: this.pricingEngine.calculate(cart, now),
    };
  }

  private async publishPending(cart: Cart): Promise<void> {
    const events = cart.pullEvents();
    if (events.length > 0) {
      await this.eventBus.publish(events);
    }
  }

  private async withOptionalIdempotency<T>(
    key: string | undefined,
    fingerprint: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!key || !key.trim()) {
      return operation();
    }
    const { result } = await this.idempotencyStore.execute(
      key.trim(),
      fingerprint,
      this.idempotencyTtlMs,
      operation,
    );
    return result;
  }
}
