import { randomUUID } from "node:crypto";
import {
  CartLimitExceededError,
  CurrencyMismatchError,
  InvalidCartStateError,
  ValidationError,
} from "./errors.ts";
import type { CartDomainEvent } from "./events.ts";
import { Money } from "./money.ts";

export type CartStatus = "ACTIVE" | "CHECKED_OUT" | "EXPIRED" | "MERGED";

export interface CartLimits {
  readonly maxDistinctItems: number;
  readonly maxQuantityPerItem: number;
  readonly maxCoupons: number;
  readonly defaultTtlMs: number;
}

export const DEFAULT_CART_LIMITS: CartLimits = {
  maxDistinctItems: 100,
  maxQuantityPerItem: 99,
  maxCoupons: 5,
  defaultTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export interface CartItemSnapshot {
  sku: string;
  name: string;
  category: string;
  unitPriceMinor: number;
  currency: string;
  quantity: number;
  taxExempt?: boolean;
  addedAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export interface CartSnapshot {
  id: string;
  ownerId: string | null;
  currency: string;
  status: CartStatus;
  version: number;
  items: CartItemSnapshot[];
  coupons: string[];
  shippingRegion: string;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface CreateCartInput {
  id?: string;
  ownerId?: string | null;
  currency?: string;
  shippingRegion?: string;
  ttlMs?: number;
  metadata?: Record<string, string>;
  now?: Date;
}

export interface AddCartItemInput {
  sku: string;
  name: string;
  category: string;
  unitPrice: Money;
  quantity: number;
  taxExempt?: boolean;
  metadata?: Record<string, string>;
  now?: Date;
}

/**
 * Cart Aggregate Root.
 * Enforces all domain invariants, optimistic versioning, TTL expiration,
 * resource limits, and emits domain events for downstream consumers.
 */
export class Cart {
  readonly id: string;
  private _ownerId: string | null;
  readonly currency: string;
  private _status: CartStatus;
  private _version: number;
  private readonly _items: Map<string, CartItemSnapshot>;
  private readonly _coupons: Set<string>;
  private _shippingRegion: string;
  private readonly _metadata: Record<string, string>;
  readonly createdAt: Date;
  private _updatedAt: Date;
  private _expiresAt: Date;
  private readonly limits: CartLimits;
  private readonly pendingEvents: CartDomainEvent[] = [];

  private constructor(
    snapshot: CartSnapshot,
    limits: CartLimits = DEFAULT_CART_LIMITS,
  ) {
    this.id = snapshot.id;
    this._ownerId = snapshot.ownerId;
    this.currency = snapshot.currency;
    this._status = snapshot.status;
    this._version = snapshot.version;
    this._items = new Map(snapshot.items.map((item) => [item.sku, { ...item }]));
    this._coupons = new Set(snapshot.coupons);
    this._shippingRegion = snapshot.shippingRegion;
    this._metadata = { ...snapshot.metadata };
    this.createdAt = new Date(snapshot.createdAt);
    this._updatedAt = new Date(snapshot.updatedAt);
    this._expiresAt = new Date(snapshot.expiresAt);
    this.limits = limits;
  }

  static create(input: CreateCartInput = {}, limits: CartLimits = DEFAULT_CART_LIMITS): Cart {
    const now = input.now ?? new Date();
    const currency = (input.currency ?? "EUR").trim().toUpperCase();
    // Validate currency via Money
    Money.zero(currency);

    const ttlMs = input.ttlMs ?? limits.defaultTtlMs;
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new ValidationError(`ttlMs must be a positive number, received: ${ttlMs}`);
    }

    const id = input.id?.trim() || `cart_${randomUUID()}`;
    const ownerId = input.ownerId ?? null;
    const expiresAt = new Date(now.getTime() + ttlMs);

    const cart = new Cart(
      {
        id,
        ownerId,
        currency,
        status: "ACTIVE",
        version: 1,
        items: [],
        coupons: [],
        shippingRegion: (input.shippingRegion ?? "ES").trim().toUpperCase(),
        metadata: input.metadata ? { ...input.metadata } : {},
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
      limits,
    );

    cart.recordEvent({
      eventId: randomUUID(),
      type: "CartCreated",
      cartId: cart.id,
      cartVersion: cart._version,
      occurredAt: now.toISOString(),
      payload: { ownerId, currency },
    });

    return cart;
  }

  static fromSnapshot(snapshot: CartSnapshot, limits: CartLimits = DEFAULT_CART_LIMITS): Cart {
    return new Cart(snapshot, limits);
  }

  get ownerId(): string | null {
    return this._ownerId;
  }

  get status(): CartStatus {
    return this._status;
  }

  get version(): number {
    return this._version;
  }

  get shippingRegion(): string {
    return this._shippingRegion;
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  get expiresAt(): Date {
    return new Date(this._expiresAt.getTime());
  }

  get items(): readonly CartItemSnapshot[] {
    return Array.from(this._items.values(), (item) => ({
      ...item,
      metadata: item.metadata ? { ...item.metadata } : undefined,
    }));
  }

  get coupons(): readonly string[] {
    return Array.from(this._coupons.values());
  }

  get totalItemUnits(): number {
    let total = 0;
    for (const item of this._items.values()) {
      total += item.quantity;
    }
    return total;
  }

  get distinctItemCount(): number {
    return this._items.size;
  }

  getItem(sku: string): CartItemSnapshot | undefined {
    const item = this._items.get(sku);
    return item ? { ...item, metadata: item.metadata ? { ...item.metadata } : undefined } : undefined;
  }

  isExpired(now: Date = new Date()): boolean {
    return this._status === "EXPIRED" || now.getTime() >= this._expiresAt.getTime();
  }

  addItem(input: AddCartItemInput): void {
    const now = input.now ?? new Date();
    this.assertActive("add item to", now);

    const sku = input.sku.trim();
    if (!sku) {
      throw new ValidationError("SKU must be a non-empty string");
    }
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new ValidationError(`Quantity to add must be a positive integer, received: ${input.quantity}`);
    }
    if (input.unitPrice.currency !== this.currency) {
      throw new CurrencyMismatchError(this.currency, input.unitPrice.currency);
    }
    if (input.unitPrice.isNegative()) {
      throw new ValidationError("Item unit price cannot be negative");
    }

    const existing = this._items.get(sku);
    if (!existing && this._items.size >= this.limits.maxDistinctItems) {
      throw new CartLimitExceededError(
        `Cart cannot contain more than ${this.limits.maxDistinctItems} distinct SKUs`,
        { maxDistinctItems: this.limits.maxDistinctItems },
      );
    }

    const nextQuantity = (existing?.quantity ?? 0) + input.quantity;
    if (nextQuantity > this.limits.maxQuantityPerItem) {
      throw new CartLimitExceededError(
        `Quantity for SKU "${sku}" cannot exceed ${this.limits.maxQuantityPerItem}`,
        { sku, maxQuantityPerItem: this.limits.maxQuantityPerItem, attempted: nextQuantity },
      );
    }

    const nowIso = now.toISOString();
    this._items.set(sku, {
      sku,
      name: input.name,
      category: input.category,
      unitPriceMinor: input.unitPrice.amountMinor,
      currency: this.currency,
      quantity: nextQuantity,
      taxExempt: input.taxExempt ?? existing?.taxExempt ?? false,
      addedAt: existing?.addedAt ?? nowIso,
      updatedAt: nowIso,
      metadata: input.metadata ?? existing?.metadata,
    });

    this.touch(now);
    this.recordEvent({
      eventId: randomUUID(),
      type: "CartItemAdded",
      cartId: this.id,
      cartVersion: this._version,
      occurredAt: nowIso,
      payload: {
        sku,
        quantityAdded: input.quantity,
        resultingQuantity: nextQuantity,
        unitPrice: input.unitPrice.toJSON(),
      },
    });
  }

  updateItemQuantity(sku: string, quantity: number, now: Date = new Date()): void {
    this.assertActive("update item in", now);

    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new ValidationError(`Quantity must be a non-negative integer, received: ${quantity}`);
    }

    const existing = this._items.get(sku);
    if (!existing) {
      throw new ValidationError(`SKU "${sku}" is not present in cart "${this.id}"`, { sku });
    }

    if (quantity === 0) {
      this.removeItem(sku, now);
      return;
    }

    if (quantity > this.limits.maxQuantityPerItem) {
      throw new CartLimitExceededError(
        `Quantity for SKU "${sku}" cannot exceed ${this.limits.maxQuantityPerItem}`,
        { sku, maxQuantityPerItem: this.limits.maxQuantityPerItem, attempted: quantity },
      );
    }

    const previousQuantity = existing.quantity;
    if (previousQuantity === quantity) {
      return;
    }

    existing.quantity = quantity;
    existing.updatedAt = now.toISOString();
    this.touch(now);

    this.recordEvent({
      eventId: randomUUID(),
      type: "CartItemQuantityUpdated",
      cartId: this.id,
      cartVersion: this._version,
      occurredAt: now.toISOString(),
      payload: {
        sku,
        previousQuantity,
        newQuantity: quantity,
      },
    });
  }

  /**
   * Synchronizes cached catalog prices/names on existing items without bumping
   * version unless something actually changed.
   */
  refreshItemPrice(
    sku: string,
    latest: { name: string; category: string; unitPrice: Money; taxExempt?: boolean },
    now: Date = new Date(),
  ): boolean {
    const existing = this._items.get(sku);
    if (!existing) return false;
    if (latest.unitPrice.currency !== this.currency) {
      throw new CurrencyMismatchError(this.currency, latest.unitPrice.currency);
    }

    const changed =
      existing.unitPriceMinor !== latest.unitPrice.amountMinor ||
      existing.name !== latest.name ||
      existing.category !== latest.category ||
      Boolean(existing.taxExempt) !== Boolean(latest.taxExempt);

    if (!changed) return false;

    existing.unitPriceMinor = latest.unitPrice.amountMinor;
    existing.name = latest.name;
    existing.category = latest.category;
    existing.taxExempt = latest.taxExempt ?? false;
    existing.updatedAt = now.toISOString();
    this.touch(now);
    return true;
  }

  removeItem(sku: string, now: Date = new Date()): boolean {
    this.assertActive("remove item from", now);
    const existing = this._items.get(sku);
    if (!existing) {
      return false;
    }

    this._items.delete(sku);
    this.touch(now);
    this.recordEvent({
      eventId: randomUUID(),
      type: "CartItemRemoved",
      cartId: this.id,
      cartVersion: this._version,
      occurredAt: now.toISOString(),
      payload: {
        sku,
        removedQuantity: existing.quantity,
      },
    });
    return true;
  }

  clear(now: Date = new Date()): void {
    this.assertActive("clear", now);
    const clearedItemCount = this._items.size;
    if (clearedItemCount === 0 && this._coupons.size === 0) {
      return;
    }

    this._items.clear();
    this._coupons.clear();
    this.touch(now);
    this.recordEvent({
      eventId: randomUUID(),
      type: "CartCleared",
      cartId: this.id,
      cartVersion: this._version,
      occurredAt: now.toISOString(),
      payload: { clearedItemCount },
    });
  }

  applyCoupon(rawCode: string, now: Date = new Date()): void {
    this.assertActive("apply coupon to", now);
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      throw new ValidationError("Coupon code cannot be empty");
    }
    if (this._coupons.has(code)) {
      return;
    }
    if (this._coupons.size >= this.limits.maxCoupons) {
      throw new CartLimitExceededError(
        `Cart cannot have more than ${this.limits.maxCoupons} coupons applied`,
        { maxCoupons: this.limits.maxCoupons },
      );
    }

    this._coupons.add(code);
    this.touch(now);
    this.recordEvent({
      eventId: randomUUID(),
      type: "CartCouponApplied",
      cartId: this.id,
      cartVersion: this._version,
      occurredAt: now.toISOString(),
      payload: { code },
    });
  }

  removeCoupon(rawCode: string, now: Date = new Date()): boolean {
    this.assertActive("remove coupon from", now);
    const code = rawCode.trim().toUpperCase();
    if (!this._coupons.delete(code)) {
      return false;
    }

    this.touch(now);
    this.recordEvent({
      eventId: randomUUID(),
      type: "CartCouponRemoved",
      cartId: this.id,
      cartVersion: this._version,
      occurredAt: now.toISOString(),
      payload: { code },
    });
    return true;
  }

  setShippingRegion(region: string, now: Date = new Date()): void {
    this.assertActive("update shipping region on", now);
    const normalized = region.trim().toUpperCase();
    if (!normalized) {
      throw new ValidationError("Shipping region cannot be empty");
    }
    if (this._shippingRegion === normalized) {
      return;
    }
    this._shippingRegion = normalized;
    this.touch(now);
  }

  assignOwner(ownerId: string, now: Date = new Date()): void {
    this.assertActive("assign owner to", now);
    const trimmed = ownerId.trim();
    if (!trimmed) {
      throw new ValidationError("ownerId cannot be empty");
    }
    if (this._ownerId === trimmed) {
      return;
    }
    this._ownerId = trimmed;
    this.touch(now);
  }

  /**
   * Merges items and coupons from a source cart (typically a guest session cart)
   * into this cart. Quantities are summed up to maxQuantityPerItem.
   */
  mergeFrom(source: Cart, now: Date = new Date()): void {
    this.assertActive("merge into", now);
    source.assertActive("merge from", now);

    if (source.id === this.id) {
      throw new ValidationError("Cannot merge a cart into itself");
    }
    if (source.currency !== this.currency) {
      throw new CurrencyMismatchError(this.currency, source.currency);
    }

    const mergedSkus: string[] = [];
    for (const srcItem of source.items) {
      const existing = this._items.get(srcItem.sku);
      if (!existing && this._items.size >= this.limits.maxDistinctItems) {
        throw new CartLimitExceededError(
          `Merging exceeds maximum distinct SKUs (${this.limits.maxDistinctItems})`,
        );
      }
      const combinedQty = Math.min(
        this.limits.maxQuantityPerItem,
        (existing?.quantity ?? 0) + srcItem.quantity,
      );
      this._items.set(srcItem.sku, {
        ...srcItem,
        quantity: combinedQty,
        addedAt: existing?.addedAt ?? srcItem.addedAt,
        updatedAt: now.toISOString(),
      });
      mergedSkus.push(srcItem.sku);
    }

    for (const coupon of source.coupons) {
      if (this._coupons.size < this.limits.maxCoupons) {
        this._coupons.add(coupon);
      }
    }

    source._status = "MERGED";
    source.touch(now);

    this.touch(now);
    this.recordEvent({
      eventId: randomUUID(),
      type: "CartMerged",
      cartId: this.id,
      cartVersion: this._version,
      occurredAt: now.toISOString(),
      payload: {
        sourceCartId: source.id,
        mergedSkus,
      },
    });
  }

  markCheckedOut(
    orderId: string,
    reservationId: string,
    grandTotal: Money,
    now: Date = new Date(),
  ): void {
    this.assertActive("checkout", now);
    if (this._items.size === 0) {
      throw new ValidationError("Cannot checkout an empty cart");
    }

    this._status = "CHECKED_OUT";
    this.touch(now);
    this.recordEvent({
      eventId: randomUUID(),
      type: "CartCheckedOut",
      cartId: this.id,
      cartVersion: this._version,
      occurredAt: now.toISOString(),
      payload: {
        orderId,
        ownerId: this._ownerId,
        reservationId,
        grandTotal: grandTotal.toJSON(),
        itemCount: this.totalItemUnits,
      },
    });
  }

  markExpired(now: Date = new Date()): void {
    if (this._status !== "ACTIVE") {
      return;
    }
    this._status = "EXPIRED";
    this._version += 1;
    this._updatedAt = now;
    this.recordEvent({
      eventId: randomUUID(),
      type: "CartExpired",
      cartId: this.id,
      cartVersion: this._version,
      occurredAt: now.toISOString(),
      payload: { expiredAt: now.toISOString() },
    });
  }

  pullEvents(): CartDomainEvent[] {
    return this.pendingEvents.splice(0, this.pendingEvents.length);
  }

  toSnapshot(): CartSnapshot {
    return {
      id: this.id,
      ownerId: this._ownerId,
      currency: this.currency,
      status: this._status,
      version: this._version,
      items: this.items.map((item) => ({ ...item })),
      coupons: Array.from(this._coupons),
      shippingRegion: this._shippingRegion,
      metadata: { ...this._metadata },
      createdAt: this.createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      expiresAt: this._expiresAt.toISOString(),
    };
  }

  private assertActive(action: string, now: Date): void {
    if (this._status === "ACTIVE" && now.getTime() >= this._expiresAt.getTime()) {
      this._status = "EXPIRED";
    }
    if (this._status !== "ACTIVE") {
      throw new InvalidCartStateError(this.id, this._status, action);
    }
  }

  private touch(now: Date): void {
    this._version += 1;
    this._updatedAt = now;
    // Sliding TTL extension on active mutations
    if (this._status === "ACTIVE") {
      this._expiresAt = new Date(now.getTime() + this.limits.defaultTtlMs);
    }
  }

  private recordEvent(event: CartDomainEvent): void {
    this.pendingEvents.push(event);
  }
}
