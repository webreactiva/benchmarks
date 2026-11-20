import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import type { CartService } from '../application/cart-service.js';
import { withIdempotency } from '../application/idempotency.js';
import type { IdempotencyStore } from '../domain/ports.js';
import { InvalidPayloadError } from '../domain/errors.js';
import type { Cart } from '../domain/cart.js';
import {
  addItemSchema,
  cartIdSchema,
  createCartSchema,
  lineIdSchema,
  mergeSchema,
  promoCodeSchema,
  promoSchema,
  setQuantitySchema,
} from './schemas.js';

export interface RouteDependencies {
  service: CartService;
  idempotency: IdempotencyStore;
  config: AppConfig;
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw new InvalidPayloadError('Petición inválida', {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

/**
 * Versión esperada del carrito (control de concurrencia optimista). Se acepta
 * `If-Match: "7"` (ETag) o `x-cart-version: 7`. Si no se envía, la operación
 * aplica "última escritura gana".
 */
function expectedVersion(request: FastifyRequest): number | null {
  const ifMatch = request.headers['if-match'];
  const fallback = request.headers['x-cart-version'];
  const raw = typeof ifMatch === 'string' && ifMatch ? ifMatch : fallback;
  if (raw === undefined) return null;
  const cleaned = String(raw).replace(/"/g, '').replace(/W\//, '').trim();
  const parsed = Number.parseInt(cleaned, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidPayloadError('Versión de carrito inválida', { version: raw });
  }
  return parsed;
}

function idempotencyKey(request: FastifyRequest): string | undefined {
  const raw = request.headers['idempotency-key'];
  return typeof raw === 'string' && raw ? raw : undefined;
}

function sendCart(reply: FastifyReply, cart: Cart, replayed = false): FastifyReply {
  reply.header('etag', `"${cart.version}"`);
  reply.header('cache-control', 'no-store');
  if (replayed) reply.header('idempotent-replay', 'true');
  return reply.status(200).send(cart);
}

export async function registerCartRoutes(
  app: FastifyInstance,
  deps: RouteDependencies,
): Promise<void> {
  const { service, idempotency, config } = deps;

  app.post('/v1/carts', async (request, reply) => {
    const body = parse(createCartSchema, request.body);
    const cart = await service.createCart(request.actor, body.currency ?? 'EUR');
    return reply.status(201).header('etag', `"${cart.version}"`).send(cart);
  });

  app.get('/v1/carts', async (request) => {
    const carts = await service.listCarts(request.actor);
    return { carts };
  });

  app.get('/v1/carts/:cartId', async (request, reply) => {
    const { cartId } = parse(cartIdSchema, request.params);
    const cart = await service.getCart(cartId, request.actor);
    void service.trackView(cartId, request.actor);
    return sendCart(reply, cart);
  });

  app.post('/v1/carts/:cartId/items', async (request, reply) => {
    const { cartId } = parse(cartIdSchema, request.params);
    const body = parse(addItemSchema, request.body);
    const version = expectedVersion(request);

    const result = await withIdempotency(
      idempotency,
      `add:${cartId}`,
      idempotencyKey(request),
      config.idempotencyTtlSeconds,
      async () => {
        const cart = await service.addItem(cartId, request.actor, body, version);
        return { statusCode: 200, body: cart };
      },
    );

    return sendCart(reply, result.body, result.replayed);
  });

  app.patch('/v1/carts/:cartId/items/:lineId', async (request, reply) => {
    const { cartId } = parse(cartIdSchema, request.params);
    const { lineId } = parse(lineIdSchema, request.params);
    const body = parse(setQuantitySchema, request.body);
    const version = expectedVersion(request);

    const result = await withIdempotency(
      idempotency,
      `qty:${cartId}:${lineId}`,
      idempotencyKey(request),
      config.idempotencyTtlSeconds,
      async () => {
        const cart = await service.setQuantity(
          cartId,
          request.actor,
          lineId,
          body.quantity,
          version,
        );
        return { statusCode: 200, body: cart };
      },
    );

    return sendCart(reply, result.body, result.replayed);
  });

  app.delete('/v1/carts/:cartId/items/:lineId', async (request, reply) => {
    const { cartId } = parse(cartIdSchema, request.params);
    const { lineId } = parse(lineIdSchema, request.params);
    const version = expectedVersion(request);

    const result = await withIdempotency(
      idempotency,
      `rm:${cartId}:${lineId}`,
      idempotencyKey(request),
      config.idempotencyTtlSeconds,
      async () => {
        const cart = await service.removeItem(cartId, request.actor, lineId, version);
        return { statusCode: 200, body: cart };
      },
    );

    return sendCart(reply, result.body, result.replayed);
  });

  app.delete('/v1/carts/:cartId/items', async (request, reply) => {
    const { cartId } = parse(cartIdSchema, request.params);
    const version = expectedVersion(request);

    const result = await withIdempotency(
      idempotency,
      `clear:${cartId}`,
      idempotencyKey(request),
      config.idempotencyTtlSeconds,
      async () => {
        const cart = await service.clear(cartId, request.actor, version);
        return { statusCode: 200, body: cart };
      },
    );

    return sendCart(reply, result.body, result.replayed);
  });

  app.post('/v1/carts/:cartId/promos', async (request, reply) => {
    const { cartId } = parse(cartIdSchema, request.params);
    const body = parse(promoSchema, request.body);
    const version = expectedVersion(request);

    const result = await withIdempotency(
      idempotency,
      `promo:${cartId}`,
      idempotencyKey(request),
      config.idempotencyTtlSeconds,
      async () => {
        const cart = await service.applyPromo(cartId, request.actor, body.code, version);
        return { statusCode: 200, body: cart };
      },
    );

    return sendCart(reply, result.body, result.replayed);
  });

  app.delete('/v1/carts/:cartId/promos/:code', async (request, reply) => {
    const { cartId } = parse(cartIdSchema, request.params);
    const { code } = parse(promoCodeSchema, request.params);
    const version = expectedVersion(request);

    const result = await withIdempotency(
      idempotency,
      `promorm:${cartId}:${code}`,
      idempotencyKey(request),
      config.idempotencyTtlSeconds,
      async () => {
        const cart = await service.removePromo(cartId, request.actor, code, version);
        return { statusCode: 200, body: cart };
      },
    );

    return sendCart(reply, result.body, result.replayed);
  });

  app.post('/v1/carts/:cartId/merge', async (request, reply) => {
    const { cartId } = parse(cartIdSchema, request.params);
    const body = parse(mergeSchema, request.body);
    const version = expectedVersion(request);

    const result = await withIdempotency(
      idempotency,
      `merge:${cartId}`,
      idempotencyKey(request),
      config.idempotencyTtlSeconds,
      async () => {
        const cart = await service.mergeCarts(
          cartId,
          body.sourceCartId,
          request.actor,
          version,
        );
        return { statusCode: 200, body: cart };
      },
    );

    return sendCart(reply, result.body, result.replayed);
  });

  app.post('/v1/carts/:cartId/checkout', async (request, reply) => {
    const { cartId } = parse(cartIdSchema, request.params);
    const version = expectedVersion(request);

    const result = await withIdempotency(
      idempotency,
      `checkout:${cartId}`,
      idempotencyKey(request),
      config.idempotencyTtlSeconds,
      async () => {
        const cart = await service.checkout(cartId, request.actor, version);
        return { statusCode: 200, body: cart };
      },
    );

    return sendCart(reply, result.body, result.replayed);
  });
}
