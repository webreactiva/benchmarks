import { randomUUID } from 'node:crypto';

export function newEventId(): string {
  return randomUUID();
}

export function newCartId(): string {
  return randomUUID();
}
