import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../application/ports.js';

/**
 * UUID based identifiers. They are random (not time ordered) on purpose: the
 * cart keys are distributed over a keyspace that must stay balanced no matter
 * how many replicas are writing.
 */
export const uuidGenerator: IdGenerator = {
  next(prefix?: string): string {
    const id = randomUUID();
    return prefix ? `${prefix}_${id}` : id;
  },
};
