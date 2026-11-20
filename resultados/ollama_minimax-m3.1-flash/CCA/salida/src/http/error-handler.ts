import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DomainError } from '../domain/errors.js';
import { RateLimitedError } from '../domain/errors.js';

/**
 * Manejador de errores: traduce los errores de dominio a respuestas HTTP
 * estables. Cualquier error no previsto se devuelve como 500 sin filtrar
 * detalles internos (se registra completo en el log).
 */
export function registerErrorHandler(app: {
  setErrorHandler: (
    handler: (
      error: Error & { statusCode?: number; validation?: unknown },
      request: FastifyRequest,
      reply: FastifyReply,
    ) => void,
  ) => void;
  log: { error: (obj: unknown, msg?: string) => void };
}): void {
  app.setErrorHandler((error, request, reply) => {
    const domainError = error as unknown as DomainError;
    if (typeof domainError.code === 'string' && typeof domainError.statusCode === 'number') {
      if (domainError.code === 'RATE_LIMITED') {
        const details = domainError.details as { retryAfterSeconds?: number } | undefined;
        reply.header('retry-after', String(details?.retryAfterSeconds ?? 1));
      }
      request.log.warn(
        { code: domainError.code, err: error },
        'error de dominio en la petición',
      );
      reply.status(domainError.statusCode).send({
        error: {
          code: domainError.code,
          message: domainError.message,
          ...(domainError.details ? { details: domainError.details } : {}),
        },
      });
      return;
    }

    request.log.error({ err: error }, 'error no controlado');
    reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno',
      },
    });
  });
}

export { RateLimitedError };
