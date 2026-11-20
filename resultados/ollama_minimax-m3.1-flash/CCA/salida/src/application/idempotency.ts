import { randomUUID } from 'node:crypto';
import type { IdempotencyStore } from '../domain/ports.js';

export interface IdempotentResult<T> {
  statusCode: number;
  body: T;
  replayed: boolean;
}

/**
 * Ejecuta una mutación de forma idempotente.
 *
 * Con la cabecera `Idempotency-Key` el cliente puede reintentar sin miedo a
 * duplicar efectos: la primera ejecución guarda su respuesta y las
 * siguientes la reproducen tal cual. La respuesta incluye `Idempotent-Replay`
 * para que el cliente sepa que se trata de una repetición.
 */
export async function withIdempotency<T>(
  store: IdempotencyStore,
  scope: string,
  key: string | undefined,
  ttlSeconds: number,
  operation: () => Promise<{ statusCode: number; body: T }>,
): Promise<IdempotentResult<T>> {
  if (!key) {
    const result = await operation();
    return { ...result, replayed: false };
  }

  const scopedKey = `${scope}:${key}`;
  const existing = await store.get(scopedKey);
  if (existing) {
    return { statusCode: existing.statusCode, body: existing.body as T, replayed: true };
  }

  const token = randomUUID();
  const acquired = await store.lock(scopedKey, token, 30);
  if (!acquired) {
    const pending = await store.waitForResult(scopedKey, 5_000);
    if (pending) {
      return { statusCode: pending.statusCode, body: pending.body as T, replayed: true };
    }
  }

  try {
    const result = await operation();
    await store.save(scopedKey, result, ttlSeconds);
    return { ...result, replayed: false };
  } finally {
    if (acquired) await store.release(scopedKey, token);
  }
}
