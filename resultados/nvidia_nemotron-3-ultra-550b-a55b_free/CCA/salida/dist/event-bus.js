"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncEventBus = exports.InMemoryEventBus = void 0;
class InMemoryEventBus {
    constructor() {
        this.handlers = new Map();
    }
    async publish(event) {
        const handlers = this.handlers.get(event.type);
        if (handlers) {
            await Promise.all(Array.from(handlers).map((handler) => handler(event)));
        }
    }
    subscribe(eventType, handler) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }
        this.handlers.get(eventType).add(handler);
    }
    unsubscribe(eventType, handler) {
        const handlers = this.handlers.get(eventType);
        if (handlers) {
            handlers.delete(handler);
        }
    }
}
exports.InMemoryEventBus = InMemoryEventBus;
class AsyncEventBus {
    constructor() {
        this.handlers = new Map();
        this.queue = [];
        this.processing = false;
    }
    async publish(event) {
        this.queue.push(event);
        if (!this.processing) {
            this.processQueue();
        }
    }
    async processQueue() {
        this.processing = true;
        while (this.queue.length > 0) {
            const event = this.queue.shift();
            const handlers = this.handlers.get(event.type);
            if (handlers) {
                await Promise.allSettled(Array.from(handlers).map((handler) => handler(event)));
            }
        }
        this.processing = false;
    }
    subscribe(eventType, handler) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }
        this.handlers.get(eventType).add(handler);
    }
    unsubscribe(eventType, handler) {
        const handlers = this.handlers.get(eventType);
        if (handlers) {
            handlers.delete(handler);
        }
    }
}
exports.AsyncEventBus = AsyncEventBus;
//# sourceMappingURL=event-bus.js.map