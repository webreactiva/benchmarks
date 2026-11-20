import { randomUUID } from "node:crypto";
import { Cart } from "../domain/cart.js";
import type { DomainEvent } from "../domain/events.js";
import { domainEvent } from "../domain/events.js";
import {
  CartNotFoundError,
  CouponInvalidError,
  InsufficientStockError,
  ProductNotFoundError,
  VersionConflictError,
} from "../domain/errors.js";
import { computeTotals, assertCouponUsable, type PricingConfig, type Totals } from "../domain/pricing.js";
import type { CartView } from "./cartView.js";
import { toCartView } from "./cartView.js";
import type { CartRepository, CouponRepository, EventBus, ProductCatalog } from "./ports.js";

export interface OrderSummary {
  orderId: string;
  cartId: string;
  items: CartView["items"];
  totals: Totals;
  checkedOutAt: string;
}

export interface CartServiceOptions {
  pricing: PricingConfig;
  /** Time-to-live applied to newly created carts. Null disables expiry. */
  cartTtlMs: number | null;
}

export class CartService {
  constructor(
    private readonly carts: CartRepository,
    private readonly catalog: ProductCatalog,
    private readonly coupons: CouponRepository,
    private readonly events: EventBus,
    private readonly options: CartServiceOptions,
  ) {}

  async createCart(ownerId: string | null = null): Promise<CartView> {
    const cart = Cart.create(randomUUID(), ownerId, this.options.cartTtlMs);
    await this.carts.insert(cart);
    await this.publish([domainEvent("cart.created", cart.id, { ownerId })]);
    return this.view(cart);
  }

  async getCart(cartId: string): Promise<CartView> {
    return this.view(await this.load(cartId));
  }

  async addItem(
    cartId: string,
    productId: string,
    quantity: number,
    expectedVersion?: number,
  ): Promise<CartView> {
    const cart = await this.loadForMutation(cartId, expectedVersion);
    const product = await this.catalog.getById(productId);
    if (!product) throw new ProductNotFoundError(productId);

    cart.addItem(product, quantity);
    await this.saveMutation(cart, [
      domainEvent("cart.item_added", cart.id, { productId, quantity }),
    ]);
    return this.view(cart);
  }

  async setItemQuantity(
    cartId: string,
    productId: string,
    quantity: number,
    expectedVersion?: number,
  ): Promise<CartView> {
    const cart = await this.loadForMutation(cartId, expectedVersion);

    if (quantity === 0) {
      cart.removeItem(productId);
      await this.saveMutation(cart, [
        domainEvent("cart.item_removed", cart.id, { productId }),
      ]);
      return this.view(cart);
    }

    const product = await this.catalog.getById(productId);
    if (!product) throw new ProductNotFoundError(productId);

    cart.setItemQuantity(productId, quantity, product.stock);
    await this.saveMutation(cart, [
      domainEvent("cart.item_quantity_updated", cart.id, { productId, quantity }),
    ]);
    return this.view(cart);
  }

  async removeItem(cartId: string, productId: string, expectedVersion?: number): Promise<CartView> {
    const cart = await this.loadForMutation(cartId, expectedVersion);
    const removed = cart.removeItem(productId);
    if (removed) {
      await this.saveMutation(cart, [
        domainEvent("cart.item_removed", cart.id, { productId }),
      ]);
    }
    return this.view(cart);
  }

  async applyCoupon(cartId: string, code: string, expectedVersion?: number): Promise<CartView> {
    const cart = await this.loadForMutation(cartId, expectedVersion);
    const normalized = code.trim().toUpperCase();
    const coupon = await this.coupons.getByCode(normalized);
    if (!coupon) {
      throw new CouponInvalidError(normalized, "unknown code");
    }
    const subtotal = cart.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    assertCouponUsable(coupon, subtotal);

    cart.applyCoupon(normalized);
    await this.saveMutation(cart, [domainEvent("coupon.applied", cart.id, { code: normalized })]);
    return this.view(cart);
  }

  async removeCoupon(cartId: string, expectedVersion?: number): Promise<CartView> {
    const cart = await this.loadForMutation(cartId, expectedVersion);
    const removed = cart.removeCoupon();
    if (removed) {
      await this.saveMutation(cart, [domainEvent("coupon.removed", cart.id, {})]);
    }
    return this.view(cart);
  }

  async clearCart(cartId: string, expectedVersion?: number): Promise<CartView> {
    const cart = await this.loadForMutation(cartId, expectedVersion);
    if (cart.isEmpty() && cart.couponCode === null) {
      return this.view(cart);
    }
    cart.clear();
    await this.saveMutation(cart, [domainEvent("cart.cleared", cart.id, {})]);
    return this.view(cart);
  }

  async checkout(cartId: string, expectedVersion?: number): Promise<OrderSummary> {
    const cart = await this.loadForMutation(cartId, expectedVersion);
    cart.ensureNotEmpty();

    // Re-validate every line against the current catalog before committing.
    for (const item of cart.items) {
      const product = await this.catalog.getById(item.productId);
      if (!product) throw new ProductNotFoundError(item.productId);
      if (product.stock < item.quantity) {
        throw new InsufficientStockError(item.productId, item.quantity, product.stock);
      }
    }

    const coupon = cart.couponCode ? await this.coupons.getByCode(cart.couponCode) : null;
    if (cart.couponCode && !coupon) {
      throw new CouponInvalidError(cart.couponCode, "no longer available");
    }
    const totals = computeTotals(cart.items, coupon ?? null, this.options.pricing);

    for (const item of cart.items) {
      await this.catalog.decrementStock(item.productId, item.quantity);
    }

    const orderId = randomUUID();
    const checkedOutAt = new Date().toISOString();
    const summary: OrderSummary = {
      orderId,
      cartId: cart.id,
      items: cart.items.map((item) => ({
        ...item,
        lineTotalCents: item.unitPriceCents * item.quantity,
      })),
      totals,
      checkedOutAt,
    };

    cart.clear();
    await this.saveMutation(cart, [
      domainEvent("cart.checked_out", cart.id, { orderId, totalCents: totals.totalCents }),
    ]);
    return summary;
  }

  private async load(cartId: string): Promise<Cart> {
    const cart = await this.carts.getById(cartId);
    if (!cart) throw new CartNotFoundError(cartId);
    return cart;
  }

  private async loadForMutation(cartId: string, expectedVersion?: number): Promise<Cart> {
    const cart = await this.load(cartId);
    if (expectedVersion !== undefined && expectedVersion !== cart.version) {
      throw new VersionConflictError(cartId, expectedVersion, cart.version);
    }
    return cart;
  }

  private async saveMutation(cart: Cart, events: DomainEvent[]): Promise<void> {
    const expectedVersion = cart.version;
    cart.touch();
    await this.carts.save(cart, expectedVersion);
    await this.publish(events);
  }

  private async view(cart: Cart): Promise<CartView> {
    const coupon = cart.couponCode ? await this.coupons.getByCode(cart.couponCode) : null;
    let totals: Totals;
    try {
      totals = computeTotals(cart.items, coupon ?? null, this.options.pricing);
    } catch {
      // A coupon that became invalid stays on the cart but contributes no discount.
      totals = computeTotals(cart.items, null, this.options.pricing);
    }
    return toCartView(cart, totals);
  }

  private async publish(events: DomainEvent[]): Promise<void> {
    try {
      await this.events.publish(events);
    } catch (error) {
      // Events are published after commit; a bus failure must not corrupt the write.
      // In production, replace with a transactional outbox.
      console.error("Failed to publish domain events", error);
    }
  }
}
