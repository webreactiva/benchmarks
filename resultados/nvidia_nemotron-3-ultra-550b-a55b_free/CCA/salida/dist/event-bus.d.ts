import { EventBus, CartEvent, CartEventType, EventHandler } from './types';
export declare class InMemoryEventBus implements EventBus {
    private handlers;
    publish(event: CartEvent): Promise<void>;
    subscribe(eventType: CartEventType, handler: EventHandler): void;
    unsubscribe(eventType: CartEventType, handler: EventHandler): void;
}
export declare class AsyncEventBus implements EventBus {
    private handlers;
    private queue;
    private processing;
    publish(event: CartEvent): Promise<void>;
    private processQueue;
    subscribe(eventType: CartEventType, handler: EventHandler): void;
    unsubscribe(eventType: CartEventType, handler: EventHandler): void;
}
//# sourceMappingURL=event-bus.d.ts.map