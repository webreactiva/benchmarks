import { CurrencyMismatchError, ValidationError } from "./errors.ts";

export interface MoneyJSON {
  amountMinor: number;
  currency: string;
  formatted: string;
}

const CURRENCY_REGEX = /^[A-Z]{3}$/;

/**
 * Immutable Value Object representing money in minor integer units (e.g. cents)
 * to eliminate floating-point precision drift across distributed pricing calculations.
 */
export class Money {
  readonly amountMinor: number;
  readonly currency: string;

  private constructor(amountMinor: number, currency: string) {
    if (!Number.isSafeInteger(amountMinor)) {
      throw new ValidationError(`Money amountMinor must be a safe integer, received: ${amountMinor}`);
    }
    const normalized = currency.trim().toUpperCase();
    if (!CURRENCY_REGEX.test(normalized)) {
      throw new ValidationError(`Invalid ISO 4217 currency code: "${currency}"`);
    }
    this.amountMinor = amountMinor;
    this.currency = normalized;
  }

  static ofMinor(amountMinor: number, currency: string): Money {
    return new Money(amountMinor, currency);
  }

  static ofMajor(amountMajor: number, currency: string): Money {
    if (!Number.isFinite(amountMajor)) {
      throw new ValidationError(`Money amountMajor must be finite, received: ${amountMajor}`);
    }
    return new Money(Math.round(amountMajor * 100), currency);
  }

  static zero(currency: string): Money {
    return new Money(0, currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  subtractClampedZero(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(Math.max(0, this.amountMinor - other.amountMinor), this.currency);
  }

  multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new ValidationError(`Multiplication factor must be finite, received: ${factor}`);
    }
    return new Money(Math.round(this.amountMinor * factor), this.currency);
  }

  percentage(percent: number): Money {
    if (!Number.isFinite(percent) || percent < 0) {
      throw new ValidationError(`Percentage must be a non-negative finite number, received: ${percent}`);
    }
    return new Money(Math.round((this.amountMinor * percent) / 100), this.currency);
  }

  min(other: Money): Money {
    this.assertSameCurrency(other);
    return this.amountMinor <= other.amountMinor ? this : other;
  }

  max(other: Money): Money {
    this.assertSameCurrency(other);
    return this.amountMinor >= other.amountMinor ? this : other;
  }

  isNegative(): boolean {
    return this.amountMinor < 0;
  }

  isZero(): boolean {
    return this.amountMinor === 0;
  }

  greaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor >= other.amountMinor;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  format(): string {
    const sign = this.amountMinor < 0 ? "-" : "";
    const abs = Math.abs(this.amountMinor);
    const major = Math.floor(abs / 100);
    const minor = String(abs % 100).padStart(2, "0");
    return `${sign}${major}.${minor} ${this.currency}`;
  }

  toJSON(): MoneyJSON {
    return {
      amountMinor: this.amountMinor,
      currency: this.currency,
      formatted: this.format(),
    };
  }
}
