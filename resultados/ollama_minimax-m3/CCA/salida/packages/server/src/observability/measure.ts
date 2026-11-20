import type { MetricsRegistry } from './metrics.js';
import { CART_METRICS } from './metrics.js';

export interface OperationOutcome {
  readonly operation: string;
  readonly outcome: 'success' | 'error';
  readonly durationSeconds: number;
}

/**
 * Records the duration and the outcome of a cart operation.
 * Kept in one place so every use case is measured the same way.
 */
export async function measureOperation<T>(
  registry: MetricsRegistry,
  operation: string,
  handler: () => Promise<T>,
): Promise<T> {
  const startedAt = process.hrtime.bigint();
  try {
    const result = await handler();
    const duration = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    registry.increment(CART_METRICS.operations, { operation, outcome: 'success' });
    registry.observe(CART_METRICS.operationDuration, { operation }, duration);
    return result;
  } catch (error) {
    const duration = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const code = (error as { code?: string }).code ?? 'UNKNOWN';
    registry.increment(CART_METRICS.operations, { operation, outcome: 'error' });
    if (code === 'CART_CONFLICT') {
      registry.increment(CART_METRICS.conflicts, { operation });
    }
    registry.observe(CART_METRICS.operationDuration, { operation }, duration);
    throw error;
  }
}
