export interface IdempotencyRecord<TResult = unknown> {
  readonly key: string;
  readonly requestHash: string;
  readonly result: TResult;
  readonly createdAt: number;
  readonly expiresAt: number;
}

/**
 * Idempotency Store Port.
 * Prevents duplicate side effects when clients or load balancers retry requests.
 */
export interface IdempotencyStore {
  execute<TResult>(
    key: string,
    requestFingerprint: string,
    ttlMs: number,
    operation: () => Promise<TResult>,
  ): Promise<{ result: TResult; replayed: boolean }>;
}
