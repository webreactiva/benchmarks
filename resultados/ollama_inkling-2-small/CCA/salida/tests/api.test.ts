import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/http/app.js";
import { CartService } from "../src/application/cartService.js";
import { DEFAULT_PRICING_CONFIG } from "../src/domain/pricing.js";
import { InMemoryCartRepository } from "../src/infrastructure/inMemoryCartRepository.js";
import { InMemoryCouponRepository } from "../src/infrastructure/inMemoryCouponRepository.js";
import { InMemoryEventBus } from "../src/infrastructure/inMemoryEventBus.js";
import { InMemoryProductCatalog } from "../src/infrastructure/inMemoryProductCatalog.js";

function makeApp(): FastifyInstance {
  const catalog = new InMemoryProductCatalog([
    { id: "p1", name: "Widget", priceCents: 1000, stock: 10 },
    { id: "p2", name: "Gadget", priceCents: 25000, stock: 5 },
  ]);
  const cartService = new CartService(
    new InMemoryCartRepository(),
    catalog,
    new InMemoryCouponRepository([{ code: "SAVE10", type: "percentage", value: 10 }]),
    new InMemoryEventBus(),
    { pricing: { ...DEFAULT_PRICING_CONFIG }, cartTtlMs: null },
  );
  return buildApp({ cartService, productCatalog: catalog });
}

describe("HTTP API", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("runs the full cart lifecycle", async () => {
    app = makeApp();

    const create = await app.inject({ method: "POST", url: "/api/v1/carts", payload: { ownerId: "u-1" } });
    expect(create.statusCode).toBe(201);
    const cartId = create.json().data.id as string;

    const add = await app.inject({
      method: "POST",
      url: `/api/v1/carts/${cartId}/items`,
      payload: { productId: "p2", quantity: 1 },
    });
    expect(add.statusCode).toBe(200);
    expect(add.json().data.items).toHaveLength(1);

    const coupon = await app.inject({
      method: "POST",
      url: `/api/v1/carts/${cartId}/coupon`,
      payload: { code: "SAVE10" },
    });
    expect(coupon.statusCode).toBe(200);
    expect(coupon.json().data.totals.discountCents).toBe(2500);

    const checkout = await app.inject({ method: "POST", url: `/api/v1/carts/${cartId}/checkout` });
    expect(checkout.statusCode).toBe(200);
    expect(checkout.json().data.totals.subtotalCents).toBe(25000);

    const afterCheckout = await app.inject({ method: "GET", url: `/api/v1/carts/${cartId}` });
    expect(afterCheckout.json().data.items).toHaveLength(0);
  });

  it("returns 404 for unknown carts", async () => {
    app = makeApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/carts/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("CART_NOT_FOUND");
  });

  it("returns 400 for invalid payloads", async () => {
    app = makeApp();
    const create = await app.inject({ method: "POST", url: "/api/v1/carts", payload: {} });
    const cartId = create.json().data.id as string;
    const bad = await app.inject({
      method: "POST",
      url: `/api/v1/carts/${cartId}/items`,
      payload: { productId: "p1", quantity: 0 },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 on version conflict", async () => {
    app = makeApp();
    const create = await app.inject({ method: "POST", url: "/api/v1/carts", payload: {} });
    const cartId = create.json().data.id as string;
    await app.inject({
      method: "POST",
      url: `/api/v1/carts/${cartId}/items`,
      payload: { productId: "p1", quantity: 1 },
    });
    // Cart is now at version 1; send a stale expectedVersion of 0.
    const stale = await app.inject({
      method: "POST",
      url: `/api/v1/carts/${cartId}/items`,
      payload: { productId: "p1", quantity: 1, expectedVersion: 0 },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe("VERSION_CONFLICT");
  });
});
