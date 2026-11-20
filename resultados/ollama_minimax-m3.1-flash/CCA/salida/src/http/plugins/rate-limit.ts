import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { RateLimiter } from '../../domain/ports.js';
import { RateLimitedError } from '../../domain/errors.js';

const PUBLIC_PATHS = new Set(['/healthz', '/readyz', '/metrics']);

/**
 * Rate limiting distribuido (token bucket en Redis). La clave es el usuario
 * autenticado o, si no, la sesión de invitado; por último se recurre a la IP.
 * Al vivir el estado en Redis el límite es global para el servicio, no por
 * réplica.
 */
export function registerRateLimit(
  app: FastifyInstance,
  limiter: RateLimiter,
  options: { enabled: boolean },
): void {
  if (!options.enabled) return;

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0] ?? request.url;
    if (PUBLIC_PATHS.has(path)) return;

    const actor = request.actor;
    const key = actor?.userId ?? actor?.sessionId ?? request.ip;

    const result = await limiter.consume(key);
    reply.header('x-ratelimit-limit', String(result.limit));
    reply.header('x-ratelimit-remaining', String(result.remaining));
    if (!result.allowed) {
      throw new RateLimitedError(result.retryAfterSeconds);
    }
  });
}
