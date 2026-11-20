import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { CartService, CartView } from "../application/cart-service.ts";
import { DomainError, ValidationError, type DomainErrorCode } from "../domain/errors.ts";

const MAX_BODY_BYTES = 256 * 1024; // 256 KB

const ERROR_STATUS_MAP: Record<DomainErrorCode, number> = {
  VALIDATION_ERROR: 400,
  CART_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,
  CONCURRENCY_CONFLICT: 409,
  INSUFFICIENT_STOCK: 409,
  INVALID_CART_STATE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  CART_LIMIT_EXCEEDED: 422,
  CURRENCY_MISMATCH: 422,
  INVALID_COUPON: 422,
  LOCK_TIMEOUT: 503,
};

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(Buffer.from(payload, "utf-8").length),
    ...extraHeaders,
  });
  res.end(payload);
}

function sendCartView(res: ServerResponse, statusCode: number, view: CartView): void {
  sendJson(res, statusCode, view, {
    etag: `"v${view.cart.version}"`,
  });
}

function getHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseIfMatchVersion(req: IncomingMessage): number | undefined {
  const raw = getHeader(req, "if-match")?.trim();
  if (!raw) return undefined;
  const cleaned = raw.replace(/^W\//i, "").replace(/^"|"$/g, "").replace(/^v/i, "");
  const parsed = Number(cleaned);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`Invalid If-Match version header: "${raw}"`);
  }
  return parsed;
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new ValidationError(`Request body exceeds limit of ${MAX_BODY_BYTES} bytes`);
    }
    chunks.push(chunk);
  }

  if (totalBytes === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError("Request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function requireString(obj: Record<string, unknown>, field: string): string {
  const value = obj[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`Field "${field}" must be a non-empty string`);
  }
  return value.trim();
}

function requireNumber(obj: Record<string, unknown>, field: string): number {
  const value = obj[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`Field "${field}" must be a finite number`);
  }
  return value;
}

function optionalString(obj: Record<string, unknown>, field: string): string | undefined {
  const value = obj[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ValidationError(`Field "${field}" must be a string`);
  }
  return value;
}

function optionalStringRecord(
  obj: Record<string, unknown>,
  field: string,
): Record<string, string> | undefined {
  const value = obj[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`Field "${field}" must be a key-value object of strings`);
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== "string") {
      throw new ValidationError(`Field "${field}.${k}" must be a string`);
    }
    out[k] = v;
  }
  return out;
}

export function createCartHttpServer(cartService: CartService): Server {
  return createServer(async (req, res) => {
    try {
      const method = (req.method ?? "GET").toUpperCase();
      const url = new URL(req.url ?? "/", "http://localhost");
      const segments = url.pathname
        .split("/")
        .filter(Boolean)
        .map((s) => decodeURIComponent(s));

      const idempotencyKey = getHeader(req, "idempotency-key");
      const expectedVersion = parseIfMatchVersion(req);

      // GET /health
      if (method === "GET" && segments.length === 1 && segments[0] === "health") {
        sendJson(res, 200, { status: "ok", timestamp: new Date().toISOString() });
        return;
      }

      // POST /carts
      if (method === "POST" && segments.length === 1 && segments[0] === "carts") {
        const body = await readJsonBody(req);
        const view = await cartService.createCart({
          ownerId: optionalString(body, "ownerId") ?? null,
          currency: optionalString(body, "currency"),
          shippingRegion: optionalString(body, "shippingRegion"),
          metadata: optionalStringRecord(body, "metadata"),
          idempotencyKey,
        });
        sendCartView(res, 201, view);
        return;
      }

      // Routes starting with /carts/:cartId
      if (segments[0] === "carts" && segments[1]) {
        const cartId = segments[1];

        // GET /carts/:cartId
        if (method === "GET" && segments.length === 2) {
          const refreshPrices = url.searchParams.get("refreshPrices") === "true";
          const view = await cartService.getCart(cartId, { refreshPrices });
          sendCartView(res, 200, view);
          return;
        }

        // POST /carts/:cartId/items
        if (method === "POST" && segments.length === 3 && segments[2] === "items") {
          const body = await readJsonBody(req);
          const view = await cartService.addItem({
            cartId,
            sku: requireString(body, "sku"),
            quantity: requireNumber(body, "quantity"),
            metadata: optionalStringRecord(body, "metadata"),
            idempotencyKey,
            expectedVersion,
          });
          sendCartView(res, 200, view);
          return;
        }

        // DELETE /carts/:cartId/items (clear cart)
        if (method === "DELETE" && segments.length === 3 && segments[2] === "items") {
          const view = await cartService.clearCart(cartId, {
            idempotencyKey,
            expectedVersion,
          });
          sendCartView(res, 200, view);
          return;
        }

        // PATCH /carts/:cartId/items/:sku
        if (method === "PATCH" && segments.length === 4 && segments[2] === "items" && segments[3]) {
          const body = await readJsonBody(req);
          const view = await cartService.updateItemQuantity({
            cartId,
            sku: segments[3],
            quantity: requireNumber(body, "quantity"),
            idempotencyKey,
            expectedVersion,
          });
          sendCartView(res, 200, view);
          return;
        }

        // DELETE /carts/:cartId/items/:sku
        if (method === "DELETE" && segments.length === 4 && segments[2] === "items" && segments[3]) {
          const view = await cartService.removeItem({
            cartId,
            sku: segments[3],
            idempotencyKey,
            expectedVersion,
          });
          sendCartView(res, 200, view);
          return;
        }

        // POST /carts/:cartId/coupons
        if (method === "POST" && segments.length === 3 && segments[2] === "coupons") {
          const body = await readJsonBody(req);
          const view = await cartService.applyCoupon({
            cartId,
            code: requireString(body, "code"),
            idempotencyKey,
            expectedVersion,
          });
          sendCartView(res, 200, view);
          return;
        }

        // DELETE /carts/:cartId/coupons/:code
        if (method === "DELETE" && segments.length === 4 && segments[2] === "coupons" && segments[3]) {
          const view = await cartService.removeCoupon({
            cartId,
            code: segments[3],
            idempotencyKey,
            expectedVersion,
          });
          sendCartView(res, 200, view);
          return;
        }

        // PATCH /carts/:cartId/shipping-region
        if (method === "PATCH" && segments.length === 3 && segments[2] === "shipping-region") {
          const body = await readJsonBody(req);
          const view = await cartService.setShippingRegion(
            cartId,
            requireString(body, "shippingRegion"),
            { expectedVersion },
          );
          sendCartView(res, 200, view);
          return;
        }

        // POST /carts/:cartId/merge
        if (method === "POST" && segments.length === 3 && segments[2] === "merge") {
          const body = await readJsonBody(req);
          const view = await cartService.mergeCarts({
            sourceCartId: requireString(body, "sourceCartId"),
            targetCartId: cartId,
            idempotencyKey,
          });
          sendCartView(res, 200, view);
          return;
        }

        // POST /carts/:cartId/checkout
        if (method === "POST" && segments.length === 3 && segments[2] === "checkout") {
          const body = await readJsonBody(req);
          const commitInventoryImmediately =
            typeof body["commitInventoryImmediately"] === "boolean"
              ? body["commitInventoryImmediately"]
              : true;
          const result = await cartService.checkout({
            cartId,
            commitInventoryImmediately,
            idempotencyKey,
            expectedVersion,
          });
          sendJson(res, 200, result, {
            etag: `"v${result.cart.version}"`,
          });
          return;
        }
      }

      sendJson(res, 404, {
        error: {
          code: "ROUTE_NOT_FOUND",
          message: `No route matches ${method} ${url.pathname}`,
        },
      });
    } catch (error) {
      if (error instanceof DomainError) {
        const status = ERROR_STATUS_MAP[error.code] ?? 400;
        sendJson(res, status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
        return;
      }

      sendJson(res, 500, {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unexpected server error",
        },
      });
    }
  });
}
