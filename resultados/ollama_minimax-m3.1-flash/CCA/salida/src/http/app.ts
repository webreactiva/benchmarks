import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { AppConfig } from '../config.js';
import type { CartService } from '../application/cart-service.js';
import type { IdempotencyStore, RateLimiter } from '../domain/ports.js';
import { MetricsRegistry } from '../observability/metrics.js';
import { registerErrorHandler } from './error-handler.js';
import { registerContext } from './plugins/context.js';
import { registerRateLimit } from './plugins/rate-limit.js';
import { registerCartRoutes } from './routes.js';

export interface AppDependencies {
  config: AppConfig;
  service: CartService;
  idempotency: IdempotencyStore;
  rateLimiter: RateLimiter;
  metrics?: MetricsRegistry;
  readiness?: () => Promise<boolean>;
  logger?: FastifyServerOptions['logger'];
}

export function createMetrics(): MetricsRegistry {
  const metrics = new MetricsRegistry();
  metrics.defineCounter({
    name: 'cart_http_requests_total',
    help: 'Peticiones HTTP atendidas por la API de carrito',
  });
  metrics.defineHistogram({
    name: 'cart_http_request_duration_seconds',
    help: 'Latencia de las peticiones HTTP de carrito',
  });
  metrics.defineCounter({
    name: 'cart_mutations_total',
    help: 'Mutaciones de carrito aplicadas',
  });
  metrics.defineCounter({
    name: 'cart_conflicts_total',
    help: 'Conflictos de versión detectados',
  });
  metrics.defineCounter({
    name: 'cart_rate_limited_total',
    help: 'Peticiones bloqueadas por el limitador de peticiones',
  });
  return metrics;
}

/**
 * Construye la API. La instancia no guarda ningún estado de negocio: todo el
 * estado del carrito vive en Redis, por lo que se pueden ejecutar N réplicas
 * detrás de un balanceador sin afinidad de sesión.
 */
export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  const { config, service, idempotency, rateLimiter } = deps;
  const metrics = deps.metrics ?? createMetrics();

  const app = Fastify({
    logger:
      deps.logger ??
      {
        level: config.logLevel,
        ...(config.logPretty ? { transport: { target: 'pino-pretty' } } : {}),
      },
    trustProxy: true,
    bodyLimit: 64 * 1024,
    keepAliveTimeout: 65_000,
    requestTimeout: 30_000,
    connectionTimeout: 10_000,
  });

  app.decorate('metrics', metrics);

  registerErrorHandler(app);
  registerContext(app, config);
  registerRateLimit(app, rateLimiter, { enabled: config.rateLimit.enabled });

  app.addHook('onRequest', async (request, reply) => {
    const startedAt = process.hrtime.bigint();
    (request as { startedAt?: bigint }).startedAt = startedAt;
    reply.header('x-request-id', request.id);
  });

  app.addHook('onResponse', async (request, reply) => {
    const startedAt = (request as { startedAt?: bigint }).startedAt ?? process.hrtime.bigint();
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    const route = request.routeOptions?.url ?? request.url;
    metrics.increment('cart_http_requests_total', {
      method: request.method,
      route,
      status: String(reply.statusCode),
    });
    metrics.observe('cart_http_request_duration_seconds', { route }, durationSeconds);
  });

  await registerCartRoutes(app, { service, idempotency, config });

  app.get('/healthz', async () => ({ status: 'ok', uptime: process.uptime() }));

  app.get('/readyz', async (_request, reply) => {
    const ready = deps.readiness ? await deps.readiness() : true;
    if (!ready) {
      return reply.status(503).send({ status: 'not_ready' });
    }
    return { status: 'ready' };
  });

  app.get('/metrics', async (_request, reply) => {
    reply.header('content-type', 'text/plain; version=0.0.4; charset=utf-8');
    return metrics.render();
  });

  return app;
}
