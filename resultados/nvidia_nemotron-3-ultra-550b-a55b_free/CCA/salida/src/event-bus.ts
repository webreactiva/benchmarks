import { EventBus, CartEvent, CartEventType, EventHandler } from './types';

export class InMemoryEventBus implements EventBus {
  private handlers: Map<CartEventType, Set<EventHandler>> = new Map();

  async publish(event: CartEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      await Promise.all(
        Array.from(handlers).map((handler) => handler(event))
      );
    }
  }

  subscribe(eventType: CartEventType, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  unsubscribe(eventType: CartEventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }
}

export class AsyncEventBus implements EventBus {
  private handlers: Map<CartEventType, Set<EventHandler>> = new Map();
  private queue: CartEvent[] = [];
  private processing = false;

  async publish(event: CartEvent): Promise<void> {
    this.queue.push(event);
    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      const handlers = this.handlers.get(event.type);
      if (handlers) {
        await Promise.allSettled(
          Array.from(handlers).map((handler) => handler(event))
        );
      }
    }
    this.processing = false;
  }

  subscribe(eventType: CartEventType, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  unsubscribe(eventType: CartEventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }
}