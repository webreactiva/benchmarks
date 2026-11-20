export interface Product {
  productId: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}

export interface CartItem extends Product {
  addedAt: Date;
  updatedAt: Date;
}

export interface Cart {
  id: string;
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface AddItemInput {
  productId: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateItemInput {
  productId: string;
  quantity: number;
}

export interface CartEvent {
  type: CartEventType;
  cartId: string;
  timestamp: Date;
  payload: unknown;
}

export type CartEventType =
  | 'cart.created'
  | 'cart.updated'
  | 'cart.cleared'
  | 'item.added'
  | 'item.updated'
  | 'item.removed'
  | 'item.quantityChanged';

export interface StorageAdapter {
  get(cartId: string): Promise<Cart | null>;
  set(cart: Cart): Promise<void>;
  delete(cartId: string): Promise<void>;
  exists(cartId: string): Promise<boolean>;
}

export interface CartOptions {
  storage: StorageAdapter;
  eventBus?: EventBus;
  maxItems?: number;
  maxQuantityPerItem?: number;
}

export interface EventBus {
  publish(event: CartEvent): Promise<void>;
  subscribe(eventType: CartEventType, handler: EventHandler): void;
  unsubscribe(eventType: CartEventType, handler: EventHandler): void;
}

export type EventHandler = (event: CartEvent) => Promise<void> | void;

export interface CartSummary {
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  currency: string;
}