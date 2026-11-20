import { DomainError, InvalidCurrencyError } from './errors.js';

export type CurrencyCode = string;

export interface MoneyJSON {
  amountMinor: number;
  currency: CurrencyCode;
}

/**
 * Value Object inmutable para importes monetarios.
 * Almacena las cantidades en unidades mínimas enteras (p. ej. céntimos)
 * para evitar errores de redondeo en coma flotante.
 */
export class Money {
  public readonly amountMinor: number;
  public readonly currency: CurrencyCode;

  private constructor(amountMinor: number, currency: CurrencyCode) {
    if (!Number.isSafeInteger(amountMinor)) {
      throw new DomainError(
        'INVALID_MONEY_AMOUNT',
        `El importe en unidades mínimas debe ser un entero seguro. Recibido: ${amountMinor}`,
      );
    }
    const normalized = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
      throw new DomainError(
        'INVALID_CURRENCY_CODE',
        `El código de moneda debe seguir ISO-4217 (3 letras). Recibido: "${currency}"`,
      );
    }
    this.amountMinor = amountMinor;
    this.currency = normalized;
  }

  public static fromMinor(amountMinor: number, currency: CurrencyCode): Money {
    return new Money(amountMinor, currency);
  }

  public static fromMajor(amountMajor: number, currency: CurrencyCode, decimals = 2): Money {
    if (!Number.isFinite(amountMajor)) {
      throw new DomainError('INVALID_MONEY_AMOUNT', `Importe no válido: ${amountMajor}`);
    }
    const factor = 10 ** decimals;
    return new Money(Math.round(amountMajor * factor), currency);
  }

  public static zero(currency: CurrencyCode): Money {
    return new Money(0, currency);
  }

  public static fromJSON(json: MoneyJSON): Money {
    return new Money(json.amountMinor, json.currency);
  }

  public isZero(): boolean {
    return this.amountMinor === 0;
  }

  public isNegative(): boolean {
    return this.amountMinor < 0;
  }

  public isPositive(): boolean {
    return this.amountMinor > 0;
  }

  public assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new InvalidCurrencyError(this.currency, other.currency);
    }
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  /**
   * Resta asegurando un mínimo de 0 (útil para descuentos).
   */
  public subtractClampedZero(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(Math.max(0, this.amountMinor - other.amountMinor), this.currency);
  }

  public multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new DomainError('INVALID_MULTIPLIER', `Factor no válido: ${factor}`);
    }
    return new Money(Math.round(this.amountMinor * factor), this.currency);
  }

  public percentage(percent: number): Money {
    if (!Number.isFinite(percent) || percent < 0) {
      throw new DomainError('INVALID_PERCENTAGE', `Porcentaje no válido: ${percent}`);
    }
    return new Money(Math.round((this.amountMinor * percent) / 100), this.currency);
  }

  public min(other: Money): Money {
    this.assertSameCurrency(other);
    return this.amountMinor <= other.amountMinor ? this : other;
  }

  public max(other: Money): Money {
    this.assertSameCurrency(other);
    return this.amountMinor >= other.amountMinor ? this : other;
  }

  public equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  public greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor > other.amountMinor;
  }

  public greaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor >= other.amountMinor;
  }

  public lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor < other.amountMinor;
  }

  public toMajor(decimals = 2): number {
    return this.amountMinor / 10 ** decimals;
  }

  public format(locale = 'es-ES', decimals = 2): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(this.toMajor(decimals));
  }

  public toJSON(): MoneyJSON {
    return {
      amountMinor: this.amountMinor,
      currency: this.currency,
    };
  }
}
