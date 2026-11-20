import { DomainError } from '@cart/core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from '@cart/core';

const STATUS_BY_CODE: Record<string, number> = {
  CART_NOT_FOUND: 404,
  CART_CONFLICT: 409,
  CART_IMMUTABLE: 409,
  CART_LIMIT_EXCEEDED: 422,
  INVALID_QUANTITY: 400,
  PRODUCT_NOT_FOUND: 404,
  PRODUCT_UNAVAILABLE: 422,
  COUPON_INVALID: 422,
  COUPON_EXPIRED: 422,
  COUPON_MIN_SUBTOTAL: 422,
  INSUFFICIENT_STOCK: 409,
  FORBIDDEN: 403,
  IDEMPOTENCY_CONFLICT: 409,
  CHECKOUT_FAILED: 409,
};

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}

export function registerErrorHandler(app: FastifyInstance, logger: Logger): void {
  app.setErrorHandler(
    (error: Error & { statusCode?: number; validation?: unknown }, request, reply) => {
      const requestId = request.id;

      if (error instanceof DomainError) {
        const status = STATUS_BY_CODE[error.code] ?? 400;
        const body: ErrorBody = {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
            requestId,
          },
        };
        if (status === 409) {
          reply.header('x-cart-conflict', 'true');
        }
        reply.code(status).send(body);
        return;
      }

      // Fastify schema validation errors
      if (error.validation) {
        reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The request payload is not valid',
            details: { validation: error.validation },
            requestId,
          },
        } satisfies ErrorBody);
        return;
      }

      const status = error.statusCode ?? 500;
      if (status >= 500) {
        logger.error('unhandled request error', {
          requestId,
          method: request.method,
          url: request.url,
          error: error.message,
          stack: error.stack,
        });
      }

      reply.code(status).send({
        error: {
          code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
          message: status >= 500 ? 'Internal server error' : error.message,
          requestId,
        },
      } satisfies ErrorBody);
    },
  );

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply.code(404).send({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        requestId: request.id,
      },
    } satisfies ErrorBody);
  });
}
