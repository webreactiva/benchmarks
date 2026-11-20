/**
 * Money is represented as an integer amount in *minor units* (cents) plus a currency.
 * Floating point is never used for monetary arithmetic, which keeps totals exact
 * and makes the pricing engine deterministic across processes and replicas.
 */
export interface Money {
  readonly amount: number;
  readonly currency: string;
}

export class InvalidMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMoneyError';
  }
}

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function money(amount: number, currency: string): Money {
  if (!Number.isInteger(amount)) {
    throw new InvalidMoneyError(`Amount must be an integer in minor units, received: ${amount}`);
  }
  if (!Number.isSafeInteger(amount)) {
    throw new InvalidMoneyError(`Amount exceeds the safe integer range: ${amount}`);
  }
  const normalized = currency?.trim().toUpperCase() ?? '';
  if (!CURRENCY_PATTERN.test(normalized)) {
    throw new InvalidMoneyError(`Invalid ISO-4217 currency code: "${currency}"`);
  }
  return { amount, currency: normalized };
}

export function zero(currency: string): Money {
  return money(0, currency);
}

/** Converts a decimal value (e.g. 12.34) into minor units (1234). */
export function moneyFromDecimal(value: number, currency: string): Money {
  if (!Number.isFinite(value)) {
    throw new InvalidMoneyError(`Cannot convert non finite value to money: ${value}`);
  }
  return money(Math.round((value + Number.EPSILON) * 100), currency);
}

export function moneyToDecimal(value: Money): number {
  return value.amount / 100;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new InvalidMoneyError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

export function negate(a: Money): Money {
  return money(-a.amount, a.currency);
}

export function multiply(a: Money, factor: number): Money {
  if (!Number.isInteger(factor) || factor < 0) {
    throw new InvalidMoneyError(`Multiplier must be a non negative integer, received: ${factor}`);
  }
  return money(a.amount * factor, a.currency);
}

/** Applies a rate (0.21 == 21%) rounding half up to the nearest minor unit. */
export function applyRate(a: Money, rate: number): Money {
  if (!Number.isFinite(rate) || rate < 0) {
    throw new InvalidMoneyError(`Rate must be a positive finite number, received: ${rate}`);
  }
  return money(Math.round(a.amount * rate), a.currency);
}

export function sumMoney(items: readonly Money[], currency: string): Money {
  return items.reduce<Money>((acc, item) => add(acc, item), zero(currency));
}

export function compare(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  if (a.amount === b.amount) return 0;
  return a.amount < b.amount ? -1 : 1;
}

export function isZero(a: Money): boolean {
  return a.amount === 0;
}

export function isNegative(a: Money): boolean {
  return a.amount < 0;
}

export function max(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return a.amount >= b.amount ? a : b;
}

export function min(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return a.amount <= b.amount ? a : b;
}

export function clampNonNegative(a: Money): Money {
  return a.amount < 0 ? zero(a.currency) : a;
}

export function formatMoney(a: Money, locale = 'es-ES'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: a.currency }).format(
    a.amount / 100,
  );
}
