import { createHash } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IdempotencyStore } from '@cart/core';

export interface IdempotencyOptions {
  readonly store: IdempotencyStore;
  readonly ttlSeconds: number;
  readonly request: FastifyRequest;
  readonly reply: FastifyReply;
  readonly handler: () => Promise<unknown>;
  readonly statusCode?: number;
}

const hashPayload = (request: FastifyRequest): string =>
  createHash('sha256')
    .update(`${request.method}::${request.url}::${JSON.stringify(request.body ?? null)}`)
    .digest('hex');

/**
 * Makes a write endpoint idempotent.
 *
 * The key is claimed atomically before the operation runs, so a client that
 * retries after a timeout (or a proxy that replays the request) never creates
 * two carts, two reservations or two orders.
 */
export async function withIdempotency(options: IdempotencyOptions): Promise<void> {
  const { store, ttlSeconds, request, reply, handler } = options;
  const header = request.headers['idempotency-key'];
  const rawKey = Array.isArray(header) ? header[0] : header;

  if (!rawKey || rawKey.trim() === '') {
    reply.code(options.statusCode ?? 200).send(await handler());
    return;
  }

  // The key is scoped to the customer so two customers can use the same
  // string without colliding (the same convention used by payment providers).
  const key = `${request.customerId ?? 'anonymous'}:${rawKey.trim()}`;
  const requestHash = hashPayload(request);
  const claim = await store.claim(key, requestHash, ttlSeconds);

  if (claim === 'conflict') {
    reply.code(409).send({
      error: {
        code: 'IDEMPOTENCY_CONFLICT',
        message: `The idempotency key "${rawKey.trim()}" was already used with a different payload`,
        requestId: request.id,
      },
    });
    return;
  }

  if (claim === 'replay') {
    const record = await store.get(key);
    if (record && record.statusCode > 0) {
      reply.header('idempotent-replay', 'true').code(record.statusCode).send(record.body);
      return;
    }
    reply.code(409).send({
      error: {
        code: 'IDEMPOTENCY_IN_PROGRESS',
        message: 'A request with the same idempotency key is still being processed',
        requestId: request.id,
      },
    });
    return;
  }

  const payload = await handler();
  const statusCode = options.statusCode ?? 200;
  await store.put(
    {
      key,
      requestHash,
      statusCode,
      body: payload,
      createdAt: new Date().toISOString(),
    },
    ttlSeconds,
  );
  reply.code(statusCode).send(payload);
}
