import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { RequestContext } from '@cart/core';

declare module 'fastify' {
  interface FastifyRequest {
    /** Authenticated customer (null for guest carts). */
    customerId: string | null;
  }
}

/**
 * Resolves the caller identity.
 *
 * The demo uses a plain header as the identity provider; in a real system this
 * is where the JWT/session of the API gateway is validated. Everything
 * downstream of the plugin only deals with the `customerId` string.
 */
async function customerContextPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest('customerId', null);

  app.addHook('onRequest', async (request: FastifyRequest) => {
    const header = request.headers['x-customer-id'];
    const value = Array.isArray(header) ? header[0] : header;
    request.customerId = typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  });
}

export const registerCustomerContext = fp(customerContextPlugin);

export const contextFrom = (request: FastifyRequest): RequestContext => ({
  customerId: request.customerId,
  requestId: request.id,
});
