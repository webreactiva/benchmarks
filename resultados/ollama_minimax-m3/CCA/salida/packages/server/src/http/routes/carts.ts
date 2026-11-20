import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container.js';
import { contextFrom } from '../plugins/context.js';
import { withIdempotency } from '../plugins/idempotency.js';
import { serializeCartView, serializeCheckout } from '../serializers.js';
import { measureOperation } from '../../observability/measure.js';

const cartParams = {
  type: 'object',
  required: ['cartId'],
  properties: { cartId: { type: 'string', minLength: 1, maxLength: 128 } },
} as const;

const addItemsBody = {
  type: 'object',
  properties: {
    productId: { type: 'string', minLength: 1, maxLength: 128 },
    quantity: { type: 'integer', minimum: 1, maximum: 1000 },
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 50,
      items: {
        type: 'object',
        required: ['productId', 'quantity'],
        properties: {
          productId: { type: 'string', minLength: 1, maxLength: 128 },
          quantity: { type: 'integer', minimum: 1, maximum: 1000 },
        },
      },
    },
  },
  additionalProperties: false,
} as const;

const couponBody = {
  type: 'object',
  required: ['code'],
  properties: { code: { type: 'string', minLength: 1, maxLength: 64 } },
  additionalProperties: false,
} as const;

const mergeBody = {
  type: 'object',
  required: ['sourceCartId'],
  properties: { sourceCartId: { type: 'string', minLength: 1, maxLength: 128 } },
  additionalProperties: false,
} as const;

const quantityBody = {
  type: 'object',
  required: ['quantity'],
  properties: { quantity: { type: 'integer', minimum: 0, maximum: 1000 } },
  additionalProperties: false,
} as const;

export async function registerCartRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const { cartService, idempotency, config, metrics } = container;

  app.post('/api/v1/carts', async (request, reply) => {
    await withIdempotency({
      store: idempotency,
      ttlSeconds: config.idempotencyTtlSeconds,
      request,
      reply,
      statusCode: 201,
      handler: async () => {
        const view = await measureOperation(metrics, 'create', () =>
          cartService.createCart(request.customerId),
        );
        return serializeCartView(view);
      },
    });
  });

  app.get('/api/v1/carts', async (request, reply) => {
    if (!request.customerId) {
      reply.code(401).send({
        error: {
          code: 'CUSTOMER_REQUIRED',
          message: 'The x-customer-id header is required to list carts',
          requestId: request.id,
        },
      });
      return;
    }
    const views = await cartService.listCustomerCarts(request.customerId);
    reply.send({ carts: views.map(serializeCartView) });
  });

  app.get('/api/v1/carts/:cartId', async (request, reply) => {
    const { cartId } = request.params as { cartId: string };
    const view = await measureOperation(metrics, 'read', () =>
      cartService.getCart(cartId, contextFrom(request)),
    );
    reply.send(serializeCartView(view));
  });

  app.post(
    '/api/v1/carts/:cartId/items',
    { schema: { body: addItemsBody } },
    async (request, reply) => {
      const { cartId } = request.params as { cartId: string };
      const body = request.body as {
        productId?: string;
        quantity?: number;
        items?: { productId: string; quantity: number }[];
      };

      const commands = body.items
        ? body.items.map((item) => ({ productId: item.productId, quantity: item.quantity }))
        : body.productId
          ? [{ productId: body.productId, quantity: body.quantity ?? 1 }]
          : [];

      if (commands.length === 0) {
        reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Either productId or items must be provided',
            requestId: request.id,
          },
        });
        return;
      }

      await withIdempotency({
        store: idempotency,
        ttlSeconds: config.idempotencyTtlSeconds,
        request,
        reply,
        handler: async () => {
          const view = await measureOperation(metrics, 'add_items', () =>
            cartService.addItems(cartId, commands, contextFrom(request)),
          );
          return serializeCartView(view);
        },
      });
    },
  );

  app.patch(
    '/api/v1/carts/:cartId/items/:productId',
    { schema: { body: quantityBody } },
    async (request, reply) => {
      const { cartId, productId } = request.params as { cartId: string; productId: string };
      const { quantity } = request.body as { quantity: number };

      await withIdempotency({
        store: idempotency,
        ttlSeconds: config.idempotencyTtlSeconds,
        request,
        reply,
        handler: async () => {
          const view = await measureOperation(metrics, 'update_quantity', () =>
            cartService.updateItemQuantity(cartId, productId, quantity, contextFrom(request)),
          );
          return serializeCartView(view);
        },
      });
    },
  );

  app.delete('/api/v1/carts/:cartId/items/:productId', async (request, reply) => {
    const { cartId, productId } = request.params as { cartId: string; productId: string };
    const view = await measureOperation(metrics, 'remove_item', () =>
      cartService.removeItem(cartId, productId, contextFrom(request)),
    );
    reply.send(serializeCartView(view));
  });

  app.delete('/api/v1/carts/:cartId/items', async (request, reply) => {
    const { cartId } = request.params as { cartId: string };
    const view = await measureOperation(metrics, 'clear', () =>
      cartService.clearCart(cartId, contextFrom(request)),
    );
    reply.send(serializeCartView(view));
  });

  app.post(
    '/api/v1/carts/:cartId/coupons',
    { schema: { body: couponBody } },
    async (request, reply) => {
      const { cartId } = request.params as { cartId: string };
      const { code } = request.body as { code: string };

      await withIdempotency({
        store: idempotency,
        ttlSeconds: config.idempotencyTtlSeconds,
        request,
        reply,
        handler: async () => {
          const view = await measureOperation(metrics, 'apply_coupon', () =>
            cartService.applyCoupon(cartId, code, contextFrom(request)),
          );
          return serializeCartView(view);
        },
      });
    },
  );

  app.delete('/api/v1/carts/:cartId/coupons/:code', async (request, reply) => {
    const { cartId, code } = request.params as { cartId: string; code: string };
    const view = await measureOperation(metrics, 'remove_coupon', () =>
      cartService.removeCoupon(cartId, code, contextFrom(request)),
    );
    reply.send(serializeCartView(view));
  });

  app.post(
    '/api/v1/carts/:cartId/merge',
    { schema: { body: mergeBody } },
    async (request, reply) => {
      const { cartId } = request.params as { cartId: string };
      const { sourceCartId } = request.body as { sourceCartId: string };

      await withIdempotency({
        store: idempotency,
        ttlSeconds: config.idempotencyTtlSeconds,
        request,
        reply,
        handler: async () => {
          const view = await measureOperation(metrics, 'merge', () =>
            cartService.mergeCarts(sourceCartId, cartId, contextFrom(request)),
          );
          return serializeCartView(view);
        },
      });
    },
  );

  app.post('/api/v1/carts/:cartId/checkout', async (request, reply) => {
    const { cartId } = request.params as { cartId: string };

    await withIdempotency({
      store: idempotency,
      ttlSeconds: config.idempotencyTtlSeconds,
      request,
      reply,
      handler: async () => {
        const result = await measureOperation(metrics, 'checkout', () =>
          cartService.checkout(cartId, contextFrom(request)),
        );
        return serializeCheckout(result);
      },
    });
  });
}

export const cartSchemas = { cartParams, addItemsBody, quantityBody, couponBody, mergeBody };
