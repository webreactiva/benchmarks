import {
  addLine,
  applyCoupon,
  cartSubtotal,
  clearLines,
  convertCart,
  createCart,
  mergeCarts,
  removeCoupon,
  removeLine,
  setLineQuantity,
  type Cart,
} from '../domain/cart.js';
import { CouponError } from '../domain/errors.js';
import type { CartEventType, DomainEvent } from '../domain/events.js';
import type { CouponDefinition, ShippingPolicy } from '../domain/coupon.js';
import type { CartPolicies } from '../domain/policies.js';
import type { CatalogProduct } from '../domain/product.js';
import { CatalogService } from './catalog-service.js';
import { priceCart, type CartTotals } from './pricing-engine.js';
import type {
  CartRepository,
  Clock,
  EventPublisher,
  IdGenerator,
  Logger,
  PricingRulesProvider,
  ProductCatalog,
  StockManager,
} from './ports.js';
import { noopLogger } from './ports.js';
import { CartConflictError, CartNotFoundError, ForbiddenError } from '../domain/errors.js';

export interface RequestContext {
  readonly customerId: string | null;
  readonly requestId?: string;
  readonly idempotencyKey?: string;
}

export interface CartView {
  readonly cart: Cart;
  readonly totals: CartTotals;
}

export interface AddItemCommand {
  readonly productId: string;
  readonly quantity: number;
}

export interface CheckoutResult {
  readonly cart: Cart;
  readonly totals: CartTotals;
  readonly reservationId: string;
}

export interface CartServiceOptions {
  readonly policies: CartPolicies;
  readonly shipping: ShippingPolicy;
  readonly currency: string;
  /** How many times a conflicting write is retried before giving up. */
  readonly writeRetries?: number;
  readonly logger?: Logger;
}

export interface CartServiceDeps {
  readonly carts: CartRepository;
  readonly catalog: ProductCatalog;
  readonly rules: PricingRulesProvider;
  readonly stock: StockManager;
  readonly events: EventPublisher;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

const DEFAULT_WRITE_RETRIES = 5;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Application service orchestrating the cart use cases.
 *
 * Concurrency model: optimistic locking with bounded retries. Every mutation is
 * a pure function of the current cart state, so a conflict can simply be
 * resolved by re-reading and re-applying it. No distributed lock is needed,
 * which keeps the write path usable on any number of replicas.
 */
export class CartService {
  private readonly carts: CartRepository;
  private readonly catalogService: CatalogService;
  private readonly rules: PricingRulesProvider;
  private readonly stock: StockManager;
  private readonly events: EventPublisher;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly policies: CartPolicies;
  private readonly shipping: ShippingPolicy;
  private readonly currency: string;
  private readonly writeRetries: number;
  private readonly logger: Logger;

  constructor(deps: CartServiceDeps, options: CartServiceOptions) {
    this.carts = deps.carts;
    this.catalogService = new CatalogService(deps.catalog);
    this.rules = deps.rules;
    this.stock = deps.stock;
    this.events = deps.events;
    this.clock = deps.clock;
    this.ids = deps.ids;
    this.policies = options.policies;
    this.shipping = options.shipping;
    this.currency = options.currency;
    this.writeRetries = options.writeRetries ?? DEFAULT_WRITE_RETRIES;
    this.logger = options.logger ?? noopLogger;
  }

  // ---------------------------------------------------------------- reads ---

  async getCart(cartId: string, ctx: RequestContext): Promise<CartView> {
    const cart = await this.requireCart(cartId, ctx);
    return this.toView(cart);
  }

  async listCustomerCarts(customerId: string, limit = 20): Promise<CartView[]> {
    const carts = await this.carts.listByCustomer(customerId, limit);
    const views: CartView[] = [];
    for (const cart of carts) {
      views.push(await this.toView(cart));
    }
    return views;
  }

  async getActiveCart(customerId: string): Promise<CartView | null> {
    const cart = await this.carts.findActiveByCustomer(customerId);
    if (!cart) return null;
    return this.toView(cart);
  }

  // --------------------------------------------------------------- writes ---

  async createCart(customerId: string | null): Promise<CartView> {
    const now = this.clock.nowIso();
    const cart = createCart({
      id: this.ids.next('cart'),
      customerId,
      currency: this.currency,
      now,
    });
    const created = await this.carts.create(cart);
    await this.publish('cart.created', created, { customerId });
    return this.toView(created);
  }

  async addItem(cartId: string, command: AddItemCommand, ctx: RequestContext): Promise<CartView> {
    return this.addItems(cartId, [command], ctx);
  }

  /**
   * Adds several products in a single atomic write: either every line is added
   * or none is, which avoids half-populated carts from flaky clients.
   */
  async addItems(
    cartId: string,
    commands: readonly AddItemCommand[],
    ctx: RequestContext,
  ): Promise<CartView> {
    if (commands.length === 0) {
      const cart = await this.requireCart(cartId, ctx);
      return this.toView(cart);
    }

    const products = await this.catalogService.requireProducts(commands.map((c) => c.productId));
    const prepared = commands.map((command) => {
      const product = products.get(command.productId) as CatalogProduct;
      return { command, product };
    });

    const now = this.clock.nowIso();
    const lineIds = new Map<string, string>();
    for (const { command } of prepared) {
      if (!lineIds.has(command.productId)) {
        lineIds.set(command.productId, this.ids.next('line'));
      }
    }

    const cart = await this.mutate(cartId, ctx, (current) => {
      let next = current;
      for (const { command, product } of prepared) {
        next = addLine(
          next,
          {
            productId: product.id,
            sku: product.sku,
            name: product.name,
            unitPrice: product.price,
            quantity: command.quantity,
            lineId: lineIds.get(product.id) as string,
          },
          now,
          this.policies,
        );
      }
      return next;
    });

    await this.publish('cart.item_added', cart, {
      products: prepared.map(({ command }) => command.productId),
      quantities: prepared.map(({ command }) => command.quantity),
    });
    return this.toView(cart);
  }

  async updateItemQuantity(
    cartId: string,
    productId: string,
    quantity: number,
    ctx: RequestContext,
  ): Promise<CartView> {
    const now = this.clock.nowIso();
    const cart = await this.mutate(cartId, ctx, (current) =>
      setLineQuantity(current, productId, quantity, now, this.policies),
    );
    await this.publish('cart.item_updated', cart, { productId, quantity });
    return this.toView(cart);
  }

  async removeItem(cartId: string, productId: string, ctx: RequestContext): Promise<CartView> {
    const now = this.clock.nowIso();
    const cart = await this.mutate(cartId, ctx, (current) =>
      removeLine(current, productId, now, this.policies),
    );
    await this.publish('cart.item_removed', cart, { productId });
    return this.toView(cart);
  }

  async clearCart(cartId: string, ctx: RequestContext): Promise<CartView> {
    const now = this.clock.nowIso();
    const cart = await this.mutate(cartId, ctx, (current) => clearLines(current, now));
    await this.publish('cart.cleared', cart, {});
    return this.toView(cart);
  }

  async applyCoupon(cartId: string, code: string, ctx: RequestContext): Promise<CartView> {
    const normalized = code.trim().toUpperCase();
    const definition = await this.rules.getCoupon(normalized);
    if (!definition || !definition.active) {
      throw new CouponError('COUPON_INVALID', `Coupon "${normalized}" does not exist`, {
        code: normalized,
      });
    }
    const now = this.clock.nowIso();
    const nowDate = this.clock.now();
    if (definition.expiresAt && new Date(definition.expiresAt) < nowDate) {
      throw new CouponError('COUPON_EXPIRED', `Coupon "${normalized}" is expired`, {
        code: normalized,
        expiresAt: definition.expiresAt,
      });
    }

    const current = await this.requireCart(cartId, ctx);
    const subtotal = cartSubtotal(current);
    if (definition.minSubtotal && subtotal.amount < definition.minSubtotal.amount) {
      throw new CouponError(
        'COUPON_MIN_SUBTOTAL',
        `Coupon "${normalized}" requires a minimum subtotal of ${definition.minSubtotal.amount}`,
        { code: normalized, minSubtotal: definition.minSubtotal.amount, subtotal: subtotal.amount },
      );
    }

    const cart = await this.mutate(cartId, ctx, (state) =>
      applyCoupon(state, definition as CouponDefinition, now),
    );
    await this.publish('cart.coupon_applied', cart, { code: normalized });
    return this.toView(cart);
  }

  async removeCoupon(cartId: string, code: string, ctx: RequestContext): Promise<CartView> {
    const normalized = code.trim().toUpperCase();
    const now = this.clock.nowIso();
    const cart = await this.mutate(cartId, ctx, (state) => removeCoupon(state, normalized, now));
    await this.publish('cart.coupon_removed', cart, { code: normalized });
    return this.toView(cart);
  }

  /**
   * Merges a guest cart into the customer cart. Used when a user logs in.
   * Both carts are written with optimistic locking so a conflict never loses
   * items: the merge is replayed against the freshest state.
   */
  async mergeCarts(
    sourceCartId: string,
    targetCartId: string,
    ctx: RequestContext,
  ): Promise<CartView> {
    let attempt = 0;
    let lastConflict: CartConflictError | undefined;

    while (attempt < this.writeRetries) {
      const source = await this.requireCart(sourceCartId, { customerId: null });
      const target = await this.requireCart(targetCartId, ctx);
      if (source.status !== 'active' || target.status !== 'active') {
        throw new CartNotFoundError(source.status !== 'active' ? sourceCartId : targetCartId);
      }
      if (source.customerId !== null && source.customerId !== target.customerId) {
        throw new ForbiddenError('The source cart belongs to a different customer');
      }

      const now = this.clock.nowIso();
      const { merged, source: convertedSource } = mergeCarts(target, source, now, this.policies);

      try {
        const savedTarget = await this.carts.save(merged, target.version);
        await this.carts.save(convertedSource, source.version);
        await this.publish('cart.merged', savedTarget, {
          sourceCartId,
          lines: savedTarget.lines.length,
        });
        return this.toView(savedTarget);
      } catch (error) {
        if (error instanceof CartConflictError) {
          lastConflict = error;
          attempt += 1;
          await sleep(2 ** attempt);
          continue;
        }
        throw error;
      }
    }

    throw lastConflict ?? new CartConflictError(targetCartId, -1, -1);
  }

  /**
   * Reserves the stock of every line atomically and closes the cart.
   * The reservation is released automatically if the cart write conflicts.
   */
  async checkout(cartId: string, ctx: RequestContext): Promise<CheckoutResult> {
    const cart = await this.requireCart(cartId, ctx);
    if (cart.lines.length === 0) {
      throw new ForbiddenError('The cart is empty');
    }

    const reservation = await this.stock.reserve(
      cart.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
    );

    try {
      const now = this.clock.nowIso();
      const saved = await this.mutate(cartId, ctx, (current) => convertCart(current, now));
      await this.publish('cart.checked_out', saved, {
        reservationId: reservation.reservationId,
        lines: saved.lines.length,
      });
      const totals = await this.computeTotals(saved);
      return { cart: saved, totals, reservationId: reservation.reservationId };
    } catch (error) {
      await this.stock.release(reservation.reservationId).catch((releaseError: unknown) => {
        this.logger.error('failed to release stock reservation', {
          cartId,
          reservationId: reservation.reservationId,
          error: String(releaseError),
        });
      });
      throw error;
    }
  }

  // -------------------------------------------------------------- helpers ---

  private async requireCart(cartId: string, ctx: RequestContext): Promise<Cart> {
    const cart = await this.carts.findById(cartId);
    if (!cart) throw new CartNotFoundError(cartId);
    if (cart.customerId !== null && cart.customerId !== ctx.customerId) {
      throw new ForbiddenError('The cart belongs to another customer', { cartId });
    }
    return cart;
  }

  /**
   * Applies a mutation with optimistic concurrency control.
   * The mutation is a pure function, so it can safely be replayed.
   */
  private async mutate(
    cartId: string,
    ctx: RequestContext,
    mutator: (cart: Cart) => Cart,
  ): Promise<Cart> {
    let attempt = 0;
    let lastConflict: CartConflictError | undefined;

    while (attempt < this.writeRetries) {
      const current = await this.requireCart(cartId, ctx);
      let next = mutator(current);
      if (next.customerId === null && ctx.customerId !== null) {
        next = { ...next, customerId: ctx.customerId };
      }
      try {
        return await this.carts.save(next, current.version);
      } catch (error) {
        if (error instanceof CartConflictError) {
          lastConflict = error;
          attempt += 1;
          this.logger.debug('cart write conflict, retrying', {
            cartId,
            attempt,
            expectedVersion: current.version,
          });
          await sleep(Math.min(2 ** attempt, 50));
          continue;
        }
        throw error;
      }
    }

    throw lastConflict ?? new CartConflictError(cartId, -1, -1);
  }

  private async computeTotals(cart: Cart): Promise<CartTotals> {
    const now = this.clock.now();
    const [promotions, coupons] = await Promise.all([
      this.rules.getPromotions(now),
      Promise.all(cart.coupons.map((coupon) => this.rules.getCoupon(coupon.code))),
    ]);

    return priceCart(
      {
        cart,
        promotions,
        coupons: coupons.filter((coupon): coupon is CouponDefinition => coupon !== null),
        shipping: this.shipping,
      },
      now,
    );
  }

  private async toView(cart: Cart): Promise<CartView> {
    return { cart, totals: await this.computeTotals(cart) };
  }

  private async publish(
    type: CartEventType,
    cart: Cart,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const event: DomainEvent = {
      id: this.ids.next('evt'),
      type,
      cartId: cart.id,
      customerId: cart.customerId,
      occurredAt: this.clock.nowIso(),
      version: cart.version,
      payload,
    };
    try {
      await this.events.publish(event);
    } catch (error) {
      // Publishing must never break the user flow: the outbox is retried later.
      this.logger.error('failed to publish cart event', {
        type,
        cartId: cart.id,
        error: String(error),
      });
    }
  }
}
