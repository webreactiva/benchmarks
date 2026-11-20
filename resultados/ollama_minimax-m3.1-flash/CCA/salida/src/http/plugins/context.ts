import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../../config.js';
import type { Actor } from '../../application/cart-service.js';
import { UnauthorizedError } from '../../domain/errors.js';
import { parseCookies, verifyToken } from '../auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor;
    sessionId: string | null;
  }
}

/**
 * Resuelve la identidad de la petición: usuario autenticado (JWT Bearer) y/o
 * sesión de invitado (cookie `sid` o cabecera `x-session-id`).
 *
 * El proceso no guarda estado de sesión: la identidad viaja en el token o en
 * la cookie, de modo que cualquier réplica del servicio puede atenderla.
 */
export function registerContext(app: FastifyInstance, config: AppConfig): void {
  app.decorateRequest('actor', null as unknown as Actor);
  app.decorateRequest('sessionId', null as unknown as string | null);

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookies = parseCookies(request.headers.cookie);
    const headerSession = request.headers['x-session-id'];
    let sessionId: string | null =
      typeof headerSession === 'string' && headerSession ? headerSession : (cookies.sid ?? null);

    let userId: string | null = null;
    const auth = request.headers.authorization;
    if (auth) {
      if (!auth.startsWith('Bearer ')) {
        throw new UnauthorizedError('Formato de cabecera Authorization inválido');
      }
      const payload = verifyToken(
        auth.slice('Bearer '.length),
        config.auth.secret,
        config.auth.issuer,
      );
      if (!payload) throw new UnauthorizedError();
      userId = payload.sub;
    }

    if (!sessionId && !userId) {
      sessionId = randomUUID();
      reply.header(
        'set-cookie',
        `sid=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`,
      );
    }

    request.actor = { userId, sessionId };
    request.sessionId = sessionId;
  });
}
