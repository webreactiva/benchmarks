import { CartEmptyError, InsufficientStockError, ProductNotFoundError } from "./errors.js";
import type { Product } from "./catalog.js";

export interface CartItem {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

export interface CartProps {
  id: string;
  ownerId: string | null;
  items: CartItem[];
  couponCode: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export const MAX_ITEM_QUANTITY = 99;

export class Cart {
  private props: CartProps;

  private constructor(props: CartProps) {
    this.props = props;
  }

  static create(id: string, ownerId: string | null, ttlMs: number | null): Cart {
    const now = new Date();
    return new Cart({
      id,
      ownerId,
      items: [],
      couponCode: null,
      version: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: ttlMs === null ? null : new Date(now.getTime() + ttlMs).toISOString(),
    });
  }

  static rehydrate(props: CartProps): Cart {
    return new Cart({
      ...props,
      items: props.items.map((item) => ({ ...item })),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get ownerId(): string | null {
    return this.props.ownerId;
  }

  get items(): readonly CartItem[] {
    return this.props.items;
  }

  get couponCode(): string | null {
    return this.props.couponCode;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): string {
    return this.props.createdAt;
  }

  get updatedAt(): string {
    return this.props.updatedAt;
  }

  get expiresAt(): string | null {
    return this.props.expiresAt;
  }

  isEmpty(): boolean {
    return this.props.items.length === 0;
  }

  isExpired(now: Date = new Date()): boolean {
    return this.props.expiresAt !== null && new Date(this.props.expiresAt).getTime() <= now.getTime();
  }

  /** Adds a product, merging with the existing line if present. Validates against catalog stock. */
  addItem(product: Product, quantity: number): CartItem {
    if (quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      throw new RangeError(`Quantity must be between 1 and ${MAX_ITEM_QUANTITY}`);
    }
    const existing = this.props.items.find((item) => item.productId === product.id);
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > MAX_ITEM_QUANTITY) {
      throw new RangeError(`Quantity must not exceed ${MAX_ITEM_QUANTITY} per line`);
    }
    if (nextQuantity > product.stock) {
      throw new InsufficientStockError(product.id, nextQuantity, product.stock);
    }
    if (existing) {
      existing.quantity = nextQuantity;
      existing.unitPriceCents = product.priceCents;
      existing.name = product.name;
      return { ...existing };
    }
    const item: CartItem = {
      productId: product.id,
      name: product.name,
      unitPriceCents: product.priceCents,
      quantity,
    };
    this.props.items.push(item);
    return { ...item };
  }

  /** Sets the absolute quantity of a line. Quantity 0 removes the line. */
  setItemQuantity(productId: string, quantity: number, availableStock: number): CartItem | null {
    if (quantity < 0 || quantity > MAX_ITEM_QUANTITY) {
      throw new RangeError(`Quantity must be between 0 and ${MAX_ITEM_QUANTITY}`);
    }
    const index = this.props.items.findIndex((item) => item.productId === productId);
    if (index === -1) {
      throw new ProductNotFoundError(productId);
    }
    if (quantity === 0) {
      this.props.items.splice(index, 1);
      return null;
    }
    if (quantity > availableStock) {
      throw new InsufficientStockError(productId, quantity, availableStock);
    }
    const item = this.props.items[index]!;
    item.quantity = quantity;
    return { ...item };
  }

  removeItem(productId: string): boolean {
    const index = this.props.items.findIndex((item) => item.productId === productId);
    if (index === -1) return false;
    this.props.items.splice(index, 1);
    return true;
  }

  clear(): void {
    this.props.items = [];
    this.props.couponCode = null;
  }

  applyCoupon(code: string): void {
    this.props.couponCode = code.trim().toUpperCase();
  }

  removeCoupon(): boolean {
    if (this.props.couponCode === null) return false;
    this.props.couponCode = null;
    return true;
  }

  ensureNotEmpty(): void {
    if (this.isEmpty()) {
      throw new CartEmptyError(this.props.id);
    }
  }

  /** Bumps the optimistic-concurrency version and the updatedAt timestamp. */
  touch(now: Date = new Date()): void {
    this.props.version += 1;
    this.props.updatedAt = now.toISOString();
  }

  toProps(): CartProps {
    return {
      ...this.props,
      items: this.props.items.map((item) => ({ ...item })),
    };
  }
}
