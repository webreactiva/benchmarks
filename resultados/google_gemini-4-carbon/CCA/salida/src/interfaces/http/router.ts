import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { CartService } from '../../application/cart-service.ts';
import type { CatalogInventoryPort } from '../../application/ports.ts';
import type { CartView } from '../../domain/cart.ts';
import { DomainError, NotFoundError } from '../../domain/errors.ts';
import type { CurrencyCode } from '../../domain/money.ts';
import type { InMemoryEventBus } from '../../infrastructure/events/in-memory-event-bus.ts';
import { renderPlaygroundHtml } from './ui.ts';
import {
  optionalString,
  parseIfMatchVersion,
  readJsonBody,
  requireNonEmptyString,
  requireNonNegativeInt,
} from './validation.ts';

export interface HttpRouterDeps {
  cartService: CartService;
  catalogInventory: CatalogInventoryPort;
  eventBus: InMemoryEventBus;
}

export function createHttpHandler(deps: HttpRouterDeps) {
  const { cartService, catalogInventory, eventBus } = deps;

  return async function handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const startHr = process.hrtime.bigint();
    try {
      const method = req.method ?? 'GET';
      const url = new URL(req.url ?? '/', 'http://localhost');
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      // Cabeceras estándar de seguridad y CORS básico para clientes SPA/Móvil
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, If-Match, Idempotency-Key',
      );
      res.setHeader('Access-Control-Expose-Headers', 'ETag, X-Idempotent-Replay');

      if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // 1. UI interactiva
      if (method === 'GET' && pathname === '/') {
        const html = renderPlaygroundHtml();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      // 2. Healthcheck para balanceadores L7 / Kubernetes probes
      if (method === 'GET' && pathname === '/health') {
        sendJson(res, 200, {
          status: 'ok',
          uptimeSeconds: Math.round(process.uptime()),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 3. Catálogo de productos
      if (method === 'GET' && pathname === '/api/v1/products') {
        const products = await catalogInventory.listProducts();
        sendJson(res, 200, { products });
        return;
      }

      // 4. Observabilidad de eventos recientes
      if (method === 'GET' && pathname === '/api/v1/events') {
        const limitParam = Number(url.searchParams.get('limit') ?? 50);
        const limit = Number.isFinite(limitParam) ? Math.min(200, Math.max(1, limitParam)) : 50;
        sendJson(res, 200, { events: eventBus.getRecentEvents(limit) });
        return;
      }

      // 5. Crear o recuperar carrito activo
      if (method === 'POST' && pathname === '/api/v1/carts') {
        const body = await readJsonBody(req);
        const idempotencyKey = headerValue(req, 'idempotency-key');
        const fingerprint = hashPayload('POST:/api/v1/carts', body);

        const { result: cart, replayed } = await cartService.runIdempotent(
          idempotencyKey,
          fingerprint,
          () =>
            cartService.createOrGetActiveCart({
              userId: optionalString(body, 'userId'),
              sessionId: optionalString(body, 'sessionId'),
              currency: optionalString(body, 'currency') as CurrencyCode | undefined,
            }),
        );

        sendCartResponse(res, 201, cart, replayed);
        return;
      }

      // 6. Fusionar carrito de invitado a usuario autenticado
      if (method === 'POST' && pathname === '/api/v1/carts/merge') {
        const body = await readJsonBody(req);
        const guestCartId = requireNonEmptyString(body, 'guestCartId');
        const userId = requireNonEmptyString(body, 'userId');
        const idempotencyKey = headerValue(req, 'idempotency-key');
        const fingerprint = hashPayload('POST:/api/v1/carts/merge', body);

        const { result: cart, replayed } = await cartService.runIdempotent(
          idempotencyKey,
          fingerprint,
          () =>
            cartService.mergeGuestCart({
              guestCartId,
              userId,
              currency: optionalString(body, 'currency') as CurrencyCode | undefined,
            }),
        );

        sendCartResponse(res, 200, cart, replayed);
        return;
      }

      // Rutas parametrizadas bajo /api/v1/carts/:cartId...
      const segments = pathname.split('/').filter(Boolean);
      if (segments[0] === 'api' && segments[1] === 'v1' && segments[2] === 'carts') {
        const cartId = decodeURIComponent(segments[3] ?? '');
        if (!cartId) {
          throw new NotFoundError('CART_NOT_FOUND', 'Ruta de carrito no válida.');
        }

        // GET /api/v1/carts/:cartId
        if (segments.length === 4 && method === 'GET') {
          const cart = await cartService.getCart(cartId);
          sendCartResponse(res, 200, cart, false);
          return;
        }

        // POST /api/v1/carts/:cartId/items
        if (segments.length === 5 && segments[4] === 'items' && method === 'POST') {
          const body = await readJsonBody(req);
          const sku = requireNonEmptyString(body, 'sku');
          const quantity = requireNonNegativeInt(body, 'quantity');
          const expectedVersion = parseIfMatchVersion(
            req.headers['if-match'],
            body.expectedVersion,
          );
          const idempotencyKey = headerValue(req, 'idempotency-key');
          const fingerprint = hashPayload(`POST:${pathname}`, body);

          const { result: cart, replayed } = await cartService.runIdempotent(
            idempotencyKey,
            fingerprint,
            () =>
              cartService.addItem({
                cartId,
                sku,
                quantity,
                expectedVersion,
              }),
          );

          sendCartResponse(res, 200, cart, replayed);
          return;
        }

        // DELETE /api/v1/carts/:cartId/items (Vaciar carrito)
        if (segments.length === 5 && segments[4] === 'items' && method === 'DELETE') {
          const expectedVersion = parseIfMatchVersion(req.headers['if-match']);
          const cart = await cartService.clearCart(cartId, expectedVersion);
          sendCartResponse(res, 200, cart, false);
          return;
        }

        // PUT | DELETE /api/v1/carts/:cartId/items/:sku
        if (segments.length === 6 && segments[4] === 'items') {
          const sku = decodeURIComponent(segments[5] ?? '');
          if (method === 'PUT') {
            const body = await readJsonBody(req);
            const quantity = requireNonNegativeInt(body, 'quantity');
            const expectedVersion = parseIfMatchVersion(
              req.headers['if-match'],
              body.expectedVersion,
            );
            const cart = await cartService.setItemQuantity({
              cartId,
              sku,
              quantity,
              expectedVersion,
            });
            sendCartResponse(res, 200, cart, false);
            return;
          }

          if (method === 'DELETE') {
            const expectedVersion = parseIfMatchVersion(req.headers['if-match']);
            const cart = await cartService.removeItem({
              cartId,
              sku,
              expectedVersion,
            });
            sendCartResponse(res, 200, cart, false);
            return;
          }
        }

        // POST | DELETE /api/v1/carts/:cartId/coupons
        if (segments.length === 5 && segments[4] === 'coupons') {
          if (method === 'POST') {
            const body = await readJsonBody(req);
            const couponCode = requireNonEmptyString(body, 'code');
            const expectedVersion = parseIfMatchVersion(
              req.headers['if-match'],
              body.expectedVersion,
            );
            const cart = await cartService.applyCoupon({
              cartId,
              couponCode,
              expectedVersion,
            });
            sendCartResponse(res, 200, cart, false);
            return;
          }

          if (method === 'DELETE') {
            const expectedVersion = parseIfMatchVersion(req.headers['if-match']);
            const cart = await cartService.removeCoupon(cartId, expectedVersion);
            sendCartResponse(res, 200, cart, false);
            return;
          }
        }

        // POST /api/v1/carts/:cartId/checkout
        if (segments.length === 5 && segments[4] === 'checkout' && method === 'POST') {
          const body = await readJsonBody(req);
          const expectedVersion = parseIfMatchVersion(
            req.headers['if-match'],
            body.expectedVersion,
          );
          const idempotencyKey = headerValue(req, 'idempotency-key');
          const fingerprint = hashPayload(`POST:${pathname}`, body);

          const { result, replayed } = await cartService.runIdempotent(
            idempotencyKey,
            fingerprint,
            () =>
              cartService.checkout({
                cartId,
                customerEmail: optionalString(body, 'customerEmail'),
                shippingAddress: optionalString(body, 'shippingAddress'),
                expectedVersion,
              }),
          );

          res.setHeader('ETag', `W/"v${result.cart.version}"`);
          res.setHeader('X-Idempotent-Replay', String(replayed));
          sendJson(res, 200, result);
          return;
        }
      }

      sendJson(res, 404, {
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: `Ruta no encontrada: ${method} ${pathname}`,
        },
      });
    } catch (error) {
      if (error instanceof DomainError) {
        sendJson(res, error.statusCode, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
        return;
      }

      console.error('[HTTP Unhandled Error]', error);
      sendJson(res, 500, {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno inesperado en el servidor.',
        },
      });
    } finally {
      const durationMs = Number(process.hrtime.bigint() - startHr) / 1_000_000;
      if (!res.headersSent) {
        res.setHeader('X-Response-Time-Ms', durationMs.toFixed(2));
      }
    }
  };
}

function sendCartResponse(
  res: ServerResponse,
  statusCode: number,
  cart: CartView,
  replayed: boolean,
): void {
  res.setHeader('ETag', `W/"v${cart.version}"`);
  res.setHeader('X-Idempotent-Replay', String(replayed));
  sendJson(res, statusCode, { cart });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const json = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const val = req.headers[name.toLowerCase()];
  const single = Array.isArray(val) ? val[0] : val;
  return single?.trim() || undefined;
}

function hashPayload(scope: string, body: Record<string, unknown>): string {
  return createHash('sha256')
    .update(`${scope}:${JSON.stringify(body)}`)
    .digest('hex');
}
