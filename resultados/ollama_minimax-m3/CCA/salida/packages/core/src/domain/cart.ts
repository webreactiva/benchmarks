import {
  CartImmutableError,
  CartLimitExceededError,
  CurrencyMismatchError,
  InvalidQuantityError,
} from './errors.js';
import type { AppliedCoupon, CouponDefinition } from './coupon.js';
import type { Money } from './money.js';
import { add as addMoney, money, multiply, zero } from './money.js';
import type { CartPolicies } from './policies.js';

export type CartStatus = 'active' | 'converted' | 'abandoned';

export interface CartLine {
  readonly id: string;
  readonly productId: string;
  readonly sku: string;
  readonly name: string;
  /** Price snapshot taken when the line was added to the cart. */
  readonly unitPrice: Money;
  readonly quantity: number;
  readonly addedAt: string;
  readonly updatedAt: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface Cart {
  readonly id: string;
  /** `null` for guest carts (cookie/token owned). */
  readonly customerId: string | null;
  readonly status: CartStatus;
  readonly currency: string;
  readonly lines: readonly CartLine[];
  readonly coupons: readonly AppliedCoupon[];
  /** Incremented by the repository on every successful write (optimistic lock). */
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCartInput {
  readonly id: string;
  readonly customerId: string | null;
  readonly currency: string;
  readonly now: string;
}

export function createCart(input: CreateCartInput): Cart {
  return {
    id: input.id,
    customerId: input.customerId,
    status: 'active',
    currency: input.currency.trim().toUpperCase(),
    lines: [],
    coupons: [],
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function findLine(cart: Cart, productId: string): CartLine | undefined {
  return cart.lines.find((line) => line.productId === productId);
}

export function lineSubtotal(line: CartLine): Money {
  return multiply(line.unitPrice, line.quantity);
}

export function cartSubtotal(cart: Cart): Money {
  return cart.lines.reduce<Money>(
    (acc, line) => addMoney(acc, lineSubtotal(line)),
    money(0, cart.currency),
  );
}

export function totalUnits(cart: Cart): number {
  return cart.lines.reduce((acc, line) => acc + line.quantity, 0);
}

function assertMutable(cart: Cart): void {
  if (cart.status !== 'active') {
    throw new CartImmutableError(cart.id);
  }
}

function assertLineQuantity(quantity: number, policies: CartPolicies): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new InvalidQuantityError(quantity, 1, policies.maxQuantityPerLine);
  }
  if (quantity > policies.maxQuantityPerLine) {
    throw new CartLimitExceededError('maxQuantityPerLine', policies.maxQuantityPerLine, quantity);
  }
}

function assertCartLimits(cart: Cart, policies: CartPolicies): void {
  if (cart.lines.length > policies.maxDistinctLines) {
    throw new CartLimitExceededError(
      'maxDistinctLines',
      policies.maxDistinctLines,
      cart.lines.length,
    );
  }
  const units = totalUnits(cart);
  if (units > policies.maxUnitsPerCart) {
    throw new CartLimitExceededError('maxUnitsPerCart', policies.maxUnitsPerCart, units);
  }
}

export interface AddLineInput {
  readonly productId: string;
  readonly sku: string;
  readonly name: string;
  readonly unitPrice: Money;
  readonly quantity: number;
  readonly lineId: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Adds a product to the cart. Adding the same product twice increments the
 * existing line instead of creating a duplicate one (one line per product).
 */
export function addLine(
  cart: Cart,
  input: AddLineInput,
  now: string,
  policies: CartPolicies,
): Cart {
  assertMutable(cart);
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new InvalidQuantityError(input.quantity, 1, policies.maxQuantityPerLine);
  }
  if (input.unitPrice.currency !== cart.currency) {
    throw new CurrencyMismatchError(cart.currency, input.unitPrice.currency);
  }

  const existing = findLine(cart, input.productId);
  const lines = existing
    ? cart.lines.map((line) =>
        line.productId === input.productId
          ? { ...line, quantity: line.quantity + input.quantity, updatedAt: now }
          : line,
      )
    : [
        ...cart.lines,
        {
          id: input.lineId,
          productId: input.productId,
          sku: input.sku,
          name: input.name,
          unitPrice: input.unitPrice,
          quantity: input.quantity,
          addedAt: now,
          updatedAt: now,
          ...(input.metadata ? { metadata: input.metadata } : {}),
        },
      ];

  const next: Cart = { ...cart, lines, updatedAt: now };
  assertLineQuantity(
    next.lines.find((l) => l.productId === input.productId)?.quantity ?? 0,
    policies,
  );
  assertCartLimits(next, policies);
  return next;
}

/** Sets an absolute quantity for a line. A quantity of 0 removes the line. */
export function setLineQuantity(
  cart: Cart,
  productId: string,
  quantity: number,
  now: string,
  policies: CartPolicies,
): Cart {
  assertMutable(cart);
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new InvalidQuantityError(quantity, 0, policies.maxQuantityPerLine);
  }
  const existing = findLine(cart, productId);
  if (!existing) {
    throw new InvalidQuantityError(quantity, 0, policies.maxQuantityPerLine);
  }
  if (quantity === 0) {
    return removeLine(cart, productId, now, policies);
  }
  assertLineQuantity(quantity, policies);

  const lines = cart.lines.map((line) =>
    line.productId === productId ? { ...line, quantity, updatedAt: now } : line,
  );
  const next: Cart = { ...cart, lines, updatedAt: now };
  assertCartLimits(next, policies);
  return next;
}

export function removeLine(
  cart: Cart,
  productId: string,
  now: string,
  _policies: CartPolicies,
): Cart {
  assertMutable(cart);
  const lines = cart.lines.filter((line) => line.productId !== productId);
  return { ...cart, lines, updatedAt: now };
}

export function clearLines(cart: Cart, now: string): Cart {
  assertMutable(cart);
  return { ...cart, lines: [], updatedAt: now };
}

/**
 * Stores the coupon on the cart. The monetary impact of a coupon is always
 * computed by the pricing engine, so the snapshot stored here is informative
 * only and never the source of truth for the total.
 */
export function applyCoupon(cart: Cart, coupon: CouponDefinition, now: string): Cart {
  assertMutable(cart);
  const applied: AppliedCoupon = {
    code: coupon.code.toUpperCase(),
    type: coupon.type,
    value: coupon.value,
    description: coupon.description,
    appliedAt: now,
    discountAmount: zero(cart.currency),
  };
  const coupons = [...cart.coupons.filter((c) => c.code !== applied.code), applied];
  return { ...cart, coupons, updatedAt: now };
}

export function removeCoupon(cart: Cart, code: string, now: string): Cart {
  assertMutable(cart);
  const normalized = code.toUpperCase();
  return { ...cart, coupons: cart.coupons.filter((c) => c.code !== normalized), updatedAt: now };
}

export function convertCart(cart: Cart, now: string): Cart {
  return { ...cart, status: 'converted', updatedAt: now };
}

/**
 * Merges a guest cart into the customer cart.
 *
 * The result keeps the *target* cart id (the customer cart is the source of
 * truth) and combines quantities according to the merge policy. When the
 * combined quantity exceeds a limit the line is clamped instead of failing, so
 * a login never loses the items the user already had.
 */
export function mergeCarts(
  target: Cart,
  source: Cart,
  now: string,
  policies: CartPolicies,
): { merged: Cart; source: Cart } {
  assertMutable(target);

  const mergedLines: CartLine[] = [...target.lines];
  for (const sourceLine of source.lines) {
    const existing = mergedLines.find((line) => line.productId === sourceLine.productId);
    if (!existing) {
      mergedLines.push({
        ...sourceLine,
        quantity: Math.min(sourceLine.quantity, policies.maxQuantityPerLine),
      });
      continue;
    }
    const combined =
      policies.mergeStrategy === 'max'
        ? Math.max(existing.quantity, sourceLine.quantity)
        : existing.quantity + sourceLine.quantity;
    mergedLines[mergedLines.indexOf(existing)] = {
      ...existing,
      quantity: Math.min(combined, policies.maxQuantityPerLine),
      updatedAt: now,
    };
  }

  const merged: Cart = {
    ...target,
    lines: mergedLines,
    coupons: [...target.coupons],
    updatedAt: now,
  };

  const clamped: Cart = {
    ...merged,
    lines: merged.lines.slice(0, policies.maxDistinctLines),
  };

  return { merged: clamped, source: convertCart(source, now) };
}
