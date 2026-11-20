import { DomainError, ValidationError } from './errors.ts';

export type CurrencyCode = 'EUR' | 'USD' | 'MXN' | 'COP' | 'ARS' | 'CLP' | 'GBP';

const SUPPORTED_CURRENCIES = new Set<string>([
  'EUR',
  'USD',
  'MXN',
  'COP',
  'ARS',
  'CLP',
  'GBP',
]);

export interface MoneyJSON {
  amountMinor: number;
  currency: CurrencyCode;
  formatted: string;
}

/**
 * Value Object inmutable para importes monetarios exactos en unidades menores (céntimos/centavos).
 * Evita errores de coma flotante IEEE 754 en cálculos de precios, descuentos e impuestos.
 */
export class Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;

  private constructor(amountMinor: number, currency: CurrencyCode) {
    if (!Number.isSafeInteger(amountMinor)) {
      throw new ValidationError(
        `El importe monetario debe ser un entero seguro en unidades menores. Recibido: ${amountMinor}`,
      );
    }
    if (!SUPPORTED_CURRENCIES.has(currency)) {
      throw new ValidationError(`Moneda no soportada: ${currency}`);
    }
    this.amountMinor = amountMinor;
    this.currency = currency;
  }

  static ofMinor(amountMinor: number, currency: CurrencyCode = 'EUR'): Money {
    return new Money(amountMinor, currency);
  }

  static zero(currency: CurrencyCode = 'EUR'): Money {
    return new Money(0, currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new DomainError(
        'CURRENCY_MISMATCH',
        `No se pueden mezclar monedas distintas: ${this.currency} y ${other.currency}.`,
        400,
      );
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

  clampNonNegative(): Money {
    return this.amountMinor < 0 ? Money.zero(this.currency) : this;
  }

  multiply(quantity: number): Money {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new ValidationError(`La cantidad debe ser un entero no negativo: ${quantity}`);
    }
    return new Money(this.amountMinor * quantity, this.currency);
  }

  /**
   * Calcula un porcentaje usando puntos básicos (100 bps = 1%, 10000 bps = 100%)
   * con redondeo half-up determinista.
   */
  percentageBps(basisPoints: number): Money {
    if (!Number.isInteger(basisPoints) || basisPoints < 0) {
      throw new ValidationError(`Los puntos básicos deben ser un entero >= 0: ${basisPoints}`);
    }
    const numerator = this.amountMinor * basisPoints;
    const rounded = Math.round(numerator / 10_000);
    return new Money(rounded, this.currency);
  }

  isGreaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor >= other.amountMinor;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  format(): string {
    const major = (this.amountMinor / 100).toFixed(2);
    return `${major} ${this.currency}`;
  }

  toJSON(): MoneyJSON {
    return {
      amountMinor: this.amountMinor,
      currency: this.currency,
      formatted: this.format(),
    };
  }
}
