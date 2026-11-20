import { describe, expect, it } from "vitest";
import { CartService } from "../src/application/cartService.js";
import {
  CartNotFoundError,
  InsufficientStockError,
  VersionConflictError,
} from "../src/domain/errors.js";
import { DEFAULT_PRICING_CONFIG } from "../src/domain/pricing.js";
import { InMemoryCartRepository } from "../src/infrastructure/inMemoryCartRepository.js";
import { InMemoryCouponRepository } from "../src/infrastructure/inMemoryCouponRepository.js";
import { InMemoryEventBus } from "../src/infrastructure/inMemoryEventBus.js";
import { InMemoryProductCatalog } from "../src/infrastructure/inMemoryProductCatalog.js";

function makeService() {
  const catalog = new InMemoryProductCatalog([
    { id: "p1", name: "Widget", priceCents: 1000, stock: 5 },
    { id: "p2", name: "Gadget", priceCents: 25000, stock: 100 },
  ]);
  const coupons = new InMemoryCouponRepository([
    { code: "SAVE10", type: "percentage", value: 10 },
  ]);
  const events = new InMemoryEventBus();
  const service = new CartService(
    new InMemoryCartRepository(),
    catalog,
    coupons,
    events,
    { pricing: { ...DEFAULT_PRICING_CONFIG }, cartTtlMs: null },
  );
  return { service, catalog, events };
}

describe("CartService", () => {
  it("creates an empty cart with version 0", async () => {
    const { service } = makeService();
    const cart = await service.createCart("user-1");
    expect(cart.items).toEqual([]);
    expect(cart.version).toBe(0);
    expect(cart.ownerId).toBe("user-1");
    expect(cart.totals.totalCents).toBe(0);
  });

  it("adds items and merges quantities for the same product", async () => {
    const { service } = makeService();
    const cart = await service.createCart(null);
    await service.addItem(cart.id, "p1", 1);
    const updated = await service.addItem(cart.id, "p1", 2);
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0]?.quantity).toBe(3);
    expect(updated.version).toBe(2);
  });

  it("rejects quantities beyond stock", async () => {
    const { service } = makeService();
    const cart = await service.createCart(null);
    await expect(service.addItem(cart.id, "p1", 6)).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it("enforces optimistic concurrency with expectedVersion", async () => {
    const { service } = makeService();
    const cart = await service.createCart(null);
    const afterAdd = await service.addItem(cart.id, "p1", 1);
    await expect(
      service.addItem(cart.id, "p2", 1, afterAdd.version - 1),
    ).rejects.toBeInstanceOf(VersionConflictError);
    // Fresh version works fine.
    const ok = await service.addItem(cart.id, "p2", 1, afterAdd.version);
    expect(ok.items).toHaveLength(2);
  });

  it("removes items when setItemQuantity is called with 0", async () => {
    const { service } = makeService();
    const cart = await service.createCart(null);
    await service.addItem(cart.id, "p1", 2);
    const updated = await service.setItemQuantity(cart.id, "p1", 0);
    expect(updated.items).toHaveLength(0);
  });

  it("applies a coupon and reflects it in the totals", async () => {
    const { service } = makeService();
    const cart = await service.createCart(null);
    await service.addItem(cart.id, "p2", 1); // 25000c, above free-shipping threshold
    const updated = await service.applyCoupon(cart.id, "save10"); // case-insensitive
    expect(updated.couponCode).toBe("SAVE10");
    expect(updated.totals.discountCents).toBe(2500);
    expect(updated.totals.shippingCents).toBe(0);
  });

  it("rejects unknown coupons", async () => {
    const { service } = makeService();
    const cart = await service.createCart(null);
    await service.addItem(cart.id, "p1", 1);
    await expect(service.applyCoupon(cart.id, "NOPE")).rejects.toThrow(/unknown code/);
  });

  it("checkout decrements stock, clears the cart and returns an order summary", async () => {
    const { service, catalog, events } = makeService();
    const cart = await service.createCart(null);
    await service.addItem(cart.id, "p1", 2);
    const order = await service.checkout(cart.id);
    expect(order.items[0]?.quantity).toBe(2);
    expect(order.totals.subtotalCents).toBe(2000);
    expect((await catalog.getById("p1"))?.stock).toBe(3);
    const after = await service.getCart(cart.id);
    expect(after.items).toHaveLength(0);
    expect(events.published.map((e) => e.type)).toContain("cart.checked_out");
  });

  it("throws CartNotFoundError for unknown carts", async () => {
    const { service } = makeService();
    await expect(service.getCart("missing")).rejects.toBeInstanceOf(CartNotFoundError);
  });
});
