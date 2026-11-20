import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import type { Container } from './container.js';
import { registerErrorHandler } from './http/plugins/error-handler.js';
import { registerCustomerContext } from './http/plugins/context.js';
import { registerCartRoutes } from './http/routes/carts.js';
import { registerProductRoutes } from './http/routes/products.js';
import { registerHealthRoutes } from './http/routes/health.js';
import { registerEventRoutes } from './http/routes/events.js';
import { HTTP_METRICS } from './observability/metrics.js';

export async function buildApp(container: Container): Promise<FastifyInstance> {
  const { config, logger, metrics } = container;

  const app = Fastify({
    logger: false,
    bodyLimit: config.bodyLimitBytes,
    trustProxy: true,
    genReqId: (request) => {
      const header = request.headers['x-request-id'];
      const value = Array.isArray(header) ? header[0] : header;
      return typeof value === 'string' && value.trim() !== '' ? value.trim() : randomUUID();
    },
  });

  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindowMs,
    keyGenerator: (request) => request.customerId ?? request.ip,
    // Health checks and the event stream must not be throttled.
    skipOnError: false,
  });

  await app.register(registerCustomerContext);
  registerErrorHandler(app, logger);

  app.addHook('onRequest', async () => {
    metrics.setGauge(HTTP_METRICS.inFlight, {}, 1);
  });

  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions?.url ?? 'unknown';
    metrics.setGauge(HTTP_METRICS.inFlight, {}, 0);
    metrics.increment(HTTP_METRICS.requests, {
      method: request.method,
      route,
      status: reply.statusCode,
    });
    metrics.observe(
      HTTP_METRICS.duration,
      { method: request.method, route },
      reply.elapsedTime / 1000,
    );
  });

  await app.register(async (scope) => {
    await registerCartRoutes(scope, container);
    await registerProductRoutes(scope, container);
    await registerEventRoutes(scope, container);
  });

  await registerHealthRoutes(app, container);

  app.addHook('onClose', async () => {
    await container.close();
  });

  return app;
}
