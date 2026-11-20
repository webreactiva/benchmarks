import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { CartService } from "../application/cartService.js";
import type { ProductCatalog } from "../application/ports.js";
import {
  CartEmptyError,
  CartNotFoundError,
  CouponInvalidError,
  DomainError,
  InsufficientStockError,
  ProductNotFoundError,
  VersionConflictError,
} from "../domain/errors.js";
import {
  addItemSchema,
  applyCouponSchema,
  cartIdParamsSchema,
  cartItemParamsSchema,
  createCartSchema,
  expectedVersionQuerySchema,
  updateItemSchema,
} from "./schemas.js";

export interface AppDependencies {
  cartService: CartService;
  productCatalog: ProductCatalog;
}

function expectedVersionFrom(request: FastifyRequest): number | undefined {
  const header = request.headers["x-cart-version"];
  if (typeof header === "string" && /^\d+$/.test(header)) {
    return Number.parseInt(header, 10);
  }
  const body = request.body as { expectedVersion?: unknown } | undefined;
  if (typeof body?.expectedVersion === "number") {
    return body.expectedVersion;
  }
  const query = expectedVersionQuerySchema.safeParse(request.query);
  if (query.success && query.data.expectedVersion !== undefined) {
    return query.data.expectedVersion;
  }
  return undefined;
}

export function buildApp(deps: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: false });
  const { cartService, productCatalog } = deps;

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid request", details: error.issues },
      });
    }
    if (error instanceof DomainError) {
      const status =
        error instanceof CartNotFoundError || error instanceof ProductNotFoundError
          ? 404
          : error instanceof VersionConflictError || error instanceof InsufficientStockError
            ? 409
            : 400;
      const body: Record<string, unknown> = { error: { code: error.code, message: error.message } };
      if (error instanceof VersionConflictError) {
        body.error = { code: error.code, message: error.message, currentVersion: error.currentVersion };
      }
      return reply.status(status).send(body);
    }
    if (error instanceof RangeError) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: error.message } });
    }
    app.log.error(error);
    return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Unexpected error" } });
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/api/v1/products", async () => ({ data: await productCatalog.list() }));

  app.post("/api/v1/carts", async (request, reply) => {
    const body = createCartSchema.parse(request.body ?? {});
    const cart = await cartService.createCart(body.ownerId ?? null);
    return reply.status(201).send({ data: cart });
  });

  app.get("/api/v1/carts/:cartId", async (request) => {
    const { cartId } = cartIdParamsSchema.parse(request.params);
    return { data: await cartService.getCart(cartId) };
  });

  app.post("/api/v1/carts/:cartId/items", async (request) => {
    const { cartId } = cartIdParamsSchema.parse(request.params);
    const body = addItemSchema.parse(request.body);
    const cart = await cartService.addItem(
      cartId,
      body.productId,
      body.quantity,
      body.expectedVersion ?? expectedVersionFrom(request),
    );
    return { data: cart };
  });

  app.patch("/api/v1/carts/:cartId/items/:productId", async (request) => {
    const { cartId, productId } = cartItemParamsSchema.parse(request.params);
    const body = updateItemSchema.parse(request.body);
    const cart = await cartService.setItemQuantity(
      cartId,
      productId,
      body.quantity,
      body.expectedVersion ?? expectedVersionFrom(request),
    );
    return { data: cart };
  });

  app.delete("/api/v1/carts/:cartId/items/:productId", async (request) => {
    const { cartId, productId } = cartItemParamsSchema.parse(request.params);
    const cart = await cartService.removeItem(cartId, productId, expectedVersionFrom(request));
    return { data: cart };
  });

  app.delete("/api/v1/carts/:cartId/items", async (request) => {
    const { cartId } = cartIdParamsSchema.parse(request.params);
    const cart = await cartService.clearCart(cartId, expectedVersionFrom(request));
    return { data: cart };
  });

  app.post("/api/v1/carts/:cartId/coupon", async (request) => {
    const { cartId } = cartIdParamsSchema.parse(request.params);
    const body = applyCouponSchema.parse(request.body);
    const cart = await cartService.applyCoupon(
      cartId,
      body.code,
      body.expectedVersion ?? expectedVersionFrom(request),
    );
    return { data: cart };
  });

  app.delete("/api/v1/carts/:cartId/coupon", async (request) => {
    const { cartId } = cartIdParamsSchema.parse(request.params);
    const cart = await cartService.removeCoupon(cartId, expectedVersionFrom(request));
    return { data: cart };
  });

  app.post("/api/v1/carts/:cartId/checkout", async (request) => {
    const { cartId } = cartIdParamsSchema.parse(request.params);
    const order = await cartService.checkout(cartId, expectedVersionFrom(request));
    return { data: order };
  });

  return app;
}
