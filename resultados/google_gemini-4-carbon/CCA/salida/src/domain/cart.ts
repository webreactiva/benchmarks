import { randomUUID } from 'node:crypto';
import { DomainError, NotFoundError, ValidationError } from './errors.ts';
import type { DomainEvent, DomainEventType } from './events.ts';
import { Money, type CurrencyCode, type MoneyJSON } from './money.ts';
import { PricingEngine, type PricingBreakdownJSON } from './pricing.ts';

export type CartStatus = 'ACTIVE' | 'CHECKED_OUT' | 'MERGED' | 'EXPIRED';

export const CART_LIMITS = {
  MAX_DISTINCT_ITEMS: 100,
  MAX_QUANTITY_PER_ITEM: 99,
  GUEST_TTL_MS: 7 * 24 * 60 * 60 * 1000, // 7 días para carritos anónimos
  USER_TTL_MS: 30 * 24 * 60 * 60 * 1000, // 30 días para usuarios autenticados
} as const;

export interface CartItemSnapshot {
  sku: string;
  name: string;
  unitPriceMinor: number;
  currency: CurrencyCode;
  quantity: number;
  imageUrl?: string;
  addedAt: string;
  updatedAt: string;
}

export interface CartSnapshot {
  id: string;
  userId: string | null;
  sessionId: string | null;
  status: CartStatus;
  currency: CurrencyCode;
  couponCode: string | null;
  items: CartItemSnapshot[];
  version: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface CartItemView {
  sku: string;
  name: string;
  unitPrice: MoneyJSON;
  quantity: number;
  lineSubtotal: MoneyJSON;
  imageUrl?: string;
  addedAt: string;
  updatedAt: string;
}

export interface CartView {
  id: string;
  userId: string | null;
  sessionId: string | null;
  status: CartStatus;
  currency: CurrencyCode;
  couponCode: string | null;
  items: CartItemView[];
  pricing: PricingBreakdownJSON;
  version: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface CreateCartParams {
  id?: string;
  userId?: string | null;
  sessionId?: string | null;
  currency?: CurrencyCode;
  now?: Date;
}

export interface AddOrUpdateItemInput {
  sku: string;
  name: string;
  unitPrice: Money;
  quantityDelta?: number;
  absoluteQuantity?: number;
  imageUrl?: string;
  now?: Date;
}

/**
 * Agregado Raíz del Dominio: Carrito de la Compra.
 * Mantiene invariantes de negocio, control de versión para concurrencia optimista
 * y registro de eventos de dominio desacoplados (patrón Outbox / Domain Events).
 */
export class Cart {
  readonly id: string;
  private _userId: string | null;
  private _sessionId: string | null;
  private _status: CartStatus;
  readonly currency: CurrencyCode;
  private _couponCode: string | null;
  private readonly _items: Map<string, CartItemSnapshot>;
  private _version: number;
  readonly createdAt: string;
  private _updatedAt: string;
  private _expiresAt: string;
  private _domainEvents: DomainEvent[] = [];

  private constructor(snapshot: CartSnapshot) {
    this.id = snapshot.id;
    this._userId = snapshot.userId;
    this._sessionId = snapshot.sessionId;
    this._status = snapshot.status;
    this.currency = snapshot.currency;
    this._couponCode = snapshot.couponCode;
    this._items = new Map(snapshot.items.map((item) => [item.sku, { ...item }]));
    this._version = snapshot.version;
    this.createdAt = snapshot.createdAt;
    this._updatedAt = snapshot.updatedAt;
    this._expiresAt = snapshot.expiresAt;
  }

  static create(params: CreateCartParams = {}): Cart {
    const now = params.now ?? new Date();
    const userId = params.userId?.trim() || null;
    const sessionId = params.sessionId?.trim() || null;

    if (!userId && !sessionId) {
      throw new ValidationError(
        'Un carrito debe pertenecer a un userId autenticado o a un sessionId de invitado.',
      );
    }

    const currency = params.currency ?? 'EUR';
    // Validación temprana de moneda a través del Value Object Money
    Money.zero(currency);

    const ttlMs = userId ? CART_LIMITS.USER_TTL_MS : CART_LIMITS.GUEST_TTL_MS;
    const nowIso = now.toISOString();
    const expiresIso = new Date(now.getTime() + ttlMs).toISOString();

    const cart = new Cart({
      id: params.id ?? `cart_${randomUUID()}`,
      userId,
      sessionId,
      status: 'ACTIVE',
      currency,
      couponCode: null,
      items: [],
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt: expiresIso,
    });

    cart.recordEvent('cart.created', nowIso, {
      userId,
      sessionId,
      currency,
    });

    return cart;
  }

  static fromSnapshot(snapshot: CartSnapshot): Cart {
    return new Cart(snapshot);
  }

  get userId(): string | null {
    return this._userId;
  }

  get sessionId(): string | null {
    return this._sessionId;
  }

  get status(): CartStatus {
    return this._status;
  }

  get couponCode(): string | null {
    return this._couponCode;
  }

  get version(): number {
    return this._version;
  }

  get updatedAt(): string {
    return this._updatedAt;
  }

  get expiresAt(): string {
    return this._expiresAt;
  }

  get items(): ReadonlyArray<CartItemSnapshot> {
    return Array.from(this._items.values());
  }

  getItem(sku: string): CartItemSnapshot | undefined {
    const item = this._items.get(sku.trim());
    return item ? { ...item } : undefined;
  }

  isExpired(now: Date = new Date()): boolean {
    return new Date(this._expiresAt).getTime() <= now.getTime();
  }

  private assertEditable(now: Date = new Date()): void {
    if (this._status !== 'ACTIVE') {
      throw new DomainError(
        'CART_NOT_ACTIVE',
        `El carrito ${this.id} no admite modificaciones en estado '${this._status}'.`,
        409,
      );
    }
    if (this.isExpired(now)) {
      this._status = 'EXPIRED';
      throw new DomainError(
        'CART_EXPIRED',
        `El carrito ${this.id} ha expirado.`,
        410,
      );
    }
  }

  private touch(now: Date): void {
    this._version += 1;
    this._updatedAt = now.toISOString();
    const ttlMs = this._userId ? CART_LIMITS.USER_TTL_MS : CART_LIMITS.GUEST_TTL_MS;
    this._expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  }

  private recordEvent(
    type: DomainEventType,
    occurredAt: string,
    payload: Record<string, unknown>,
  ): void {
    this._domainEvents.push({
      eventId: `evt_${randomUUID()}`,
      type,
      aggregateId: this.id,
      aggregateVersion: this._version,
      occurredAt,
      payload,
    });
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  upsertItem(input: AddOrUpdateItemInput): void {
    const now = input.now ?? new Date();
    this.assertEditable(now);

    const sku = input.sku.trim();
    if (!sku) {
      throw new ValidationError('El SKU del producto es obligatorio.');
    }
    if (input.unitPrice.currency !== this.currency) {
      throw new DomainError(
        'CURRENCY_MISMATCH',
        `El precio del producto (${input.unitPrice.currency}) no coincide con la moneda del carrito (${this.currency}).`,
        400,
      );
    }

    const existing = this._items.get(sku);
    let nextQuantity: number;

    if (input.absoluteQuantity !== undefined) {
      nextQuantity = input.absoluteQuantity;
    } else if (input.quantityDelta !== undefined) {
      nextQuantity = (existing?.quantity ?? 0) + input.quantityDelta;
    } else {
      throw new ValidationError('Se debe especificar quantityDelta o absoluteQuantity.');
    }

    if (!Number.isInteger(nextQuantity)) {
      throw new ValidationError('La cantidad del artículo debe ser un número entero.');
    }

    if (nextQuantity <= 0) {
      if (existing) {
        this.removeItem(sku, now);
        return;
      }
      throw new ValidationError('La cantidad a añadir debe ser mayor que cero.');
    }

    if (nextQuantity > CART_LIMITS.MAX_QUANTITY_PER_ITEM) {
      throw new ValidationError(
        `No se pueden añadir más de ${CART_LIMITS.MAX_QUANTITY_PER_ITEM} unidades de un mismo SKU (${sku}).`,
        { sku, maxQuantity: CART_LIMITS.MAX_QUANTITY_PER_ITEM },
      );
    }

    if (!existing && this._items.size >= CART_LIMITS.MAX_DISTINCT_ITEMS) {
      throw new ValidationError(
        `El carrito ha alcanzado el límite máximo de ${CART_LIMITS.MAX_DISTINCT_ITEMS} productos distintos.`,
      );
    }

    const nowIso = now.toISOString();
    this._items.set(sku, {
      sku,
      name: input.name.trim(),
      unitPriceMinor: input.unitPrice.amountMinor,
      currency: this.currency,
      quantity: nextQuantity,
      imageUrl: input.imageUrl ?? existing?.imageUrl,
      addedAt: existing?.addedAt ?? nowIso,
      updatedAt: nowIso,
    });

    this.touch(now);
    this.recordEvent('cart.item_upserted', nowIso, {
      sku,
      quantity: nextQuantity,
      unitPriceMinor: input.unitPrice.amountMinor,
    });
  }

  removeItem(sku: string, now: Date = new Date()): void {
    this.assertEditable(now);
    const normalizedSku = sku.trim();
    if (!this._items.has(normalizedSku)) {
      throw new NotFoundError(
        'ITEM_NOT_FOUND',
        `El artículo '${normalizedSku}' no se encuentra en el carrito.`,
      );
    }
    this._items.delete(normalizedSku);
    this.touch(now);
    this.recordEvent('cart.item_removed', now.toISOString(), { sku: normalizedSku });
  }

  clear(now: Date = new Date()): void {
    this.assertEditable(now);
    if (this._items.size === 0 && !this._couponCode) {
      return;
    }
    this._items.clear();
    this._couponCode = null;
    this.touch(now);
    this.recordEvent('cart.cleared', now.toISOString(), {});
  }

  applyCoupon(code: string, pricingEngine: PricingEngine, now: Date = new Date()): void {
    this.assertEditable(now);
    const subtotal = this.computeSubtotal();
    const coupon = pricingEngine.validateCouponForSubtotal(code, subtotal);
    this._couponCode = coupon.code;
    this.touch(now);
    this.recordEvent('cart.coupon_applied', now.toISOString(), {
      couponCode: coupon.code,
    });
  }

  removeCoupon(now: Date = new Date()): void {
    this.assertEditable(now);
    if (!this._couponCode) return;
    const previous = this._couponCode;
    this._couponCode = null;
    this.touch(now);
    this.recordEvent('cart.coupon_removed', now.toISOString(), {
      couponCode: previous,
    });
  }

  assignToUser(userId: string, now: Date = new Date()): void {
    this.assertEditable(now);
    const trimmed = userId.trim();
    if (!trimmed) {
      throw new ValidationError('El userId no puede estar vacío.');
    }
    this._userId = trimmed;
    this.touch(now);
  }

  /**
   * Fusiona los artículos de un carrito de invitado dentro de este carrito de usuario.
   * Respeta límites por SKU y marca el carrito origen como MERGED.
   */
  mergeFrom(guestCart: Cart, maxStockBySku?: ReadonlyMap<string, number>, now: Date = new Date()): void {
    this.assertEditable(now);
    guestCart.assertEditable(now);

    if (guestCart.id === this.id) {
      return;
    }
    if (guestCart.currency !== this.currency) {
      throw new DomainError(
        'CURRENCY_MISMATCH',
        `No se pueden fusionar carritos con distintas monedas (${this.currency} vs ${guestCart.currency}).`,
        400,
      );
    }

    const nowIso = now.toISOString();
    for (const guestItem of guestCart.items) {
      const existing = this._items.get(guestItem.sku);
      if (!existing && this._items.size >= CART_LIMITS.MAX_DISTINCT_ITEMS) {
        break;
      }
      const combined = (existing?.quantity ?? 0) + guestItem.quantity;
      const stockCap = maxStockBySku?.get(guestItem.sku) ?? CART_LIMITS.MAX_QUANTITY_PER_ITEM;
      const cappedQuantity = Math.min(
        combined,
        CART_LIMITS.MAX_QUANTITY_PER_ITEM,
        Math.max(0, stockCap),
      );

      if (cappedQuantity > 0) {
        this._items.set(guestItem.sku, {
          sku: guestItem.sku,
          name: guestItem.name,
          unitPriceMinor: guestItem.unitPriceMinor,
          currency: this.currency,
          quantity: cappedQuantity,
          imageUrl: guestItem.imageUrl ?? existing?.imageUrl,
          addedAt: existing?.addedAt ?? guestItem.addedAt,
          updatedAt: nowIso,
        });
      }
    }

    if (!this._couponCode && guestCart.couponCode) {
      this._couponCode = guestCart.couponCode;
    }

    guestCart.markMergedInto(this.id, now);
    this.touch(now);
    this.recordEvent('cart.merged', nowIso, {
      sourceCartId: guestCart.id,
      resultingItemCount: this._items.size,
    });
  }

  private markMergedInto(targetCartId: string, now: Date): void {
    this._status = 'MERGED';
    this._version += 1;
    this._updatedAt = now.toISOString();
    this.recordEvent('cart.merged', this._updatedAt, {
      mergedIntoCartId: targetCartId,
    });
  }

  markCheckedOut(orderId: string, now: Date = new Date()): void {
    this.assertEditable(now);
    if (this._items.size === 0) {
      throw new DomainError(
        'EMPTY_CART_CHECKOUT',
        'No se puede completar el checkout de un carrito vacío.',
        400,
      );
    }
    this._status = 'CHECKED_OUT';
    this._version += 1;
    this._updatedAt = now.toISOString();
    this.recordEvent('cart.checked_out', this._updatedAt, {
      orderId,
      itemCount: this._items.size,
    });
  }

  computeSubtotal(): Money {
    let subtotal = Money.zero(this.currency);
    for (const item of this._items.values()) {
      const unit = Money.ofMinor(item.unitPriceMinor, this.currency);
      subtotal = subtotal.add(unit.multiply(item.quantity));
    }
    return subtotal;
  }

  toSnapshot(): CartSnapshot {
    return {
      id: this.id,
      userId: this._userId,
      sessionId: this._sessionId,
      status: this._status,
      currency: this.currency,
      couponCode: this._couponCode,
      items: Array.from(this._items.values()).map((i) => ({ ...i })),
      version: this._version,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
      expiresAt: this._expiresAt,
    };
  }

  toView(pricingEngine: PricingEngine): CartView {
    const orderedItems = Array.from(this._items.values()).sort((a, b) =>
      a.addedAt.localeCompare(b.addedAt) || a.sku.localeCompare(b.sku),
    );

    const pricedItems = orderedItems.map((item) => ({
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: Money.ofMinor(item.unitPriceMinor, this.currency),
    }));

    const breakdown = pricingEngine.calculate(
      pricedItems,
      this.currency,
      this._couponCode,
    );

    return {
      id: this.id,
      userId: this._userId,
      sessionId: this._sessionId,
      status: this._status,
      currency: this.currency,
      couponCode: this._couponCode,
      items: orderedItems.map((item) => {
        const unitPrice = Money.ofMinor(item.unitPriceMinor, this.currency);
        return {
          sku: item.sku,
          name: item.name,
          unitPrice: unitPrice.toJSON(),
          quantity: item.quantity,
          lineSubtotal: unitPrice.multiply(item.quantity).toJSON(),
          imageUrl: item.imageUrl,
          addedAt: item.addedAt,
          updatedAt: item.updatedAt,
        };
      }),
      pricing: PricingEngine.toJSON(breakdown),
      version: this._version,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
      expiresAt: this._expiresAt,
    };
  }
}
