import { DomainError, InvalidCurrencyError } from './errors.js';
/**
 * Value Object inmutable para importes monetarios.
 * Almacena las cantidades en unidades mínimas enteras (p. ej. céntimos)
 * para evitar errores de redondeo en coma flotante.
 */
export class Money {
    amountMinor;
    currency;
    constructor(amountMinor, currency) {
        if (!Number.isSafeInteger(amountMinor)) {
            throw new DomainError('INVALID_MONEY_AMOUNT', `El importe en unidades mínimas debe ser un entero seguro. Recibido: ${amountMinor}`);
        }
        const normalized = currency.trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(normalized)) {
            throw new DomainError('INVALID_CURRENCY_CODE', `El código de moneda debe seguir ISO-4217 (3 letras). Recibido: "${currency}"`);
        }
        this.amountMinor = amountMinor;
        this.currency = normalized;
    }
    static fromMinor(amountMinor, currency) {
        return new Money(amountMinor, currency);
    }
    static fromMajor(amountMajor, currency, decimals = 2) {
        if (!Number.isFinite(amountMajor)) {
            throw new DomainError('INVALID_MONEY_AMOUNT', `Importe no válido: ${amountMajor}`);
        }
        const factor = 10 ** decimals;
        return new Money(Math.round(amountMajor * factor), currency);
    }
    static zero(currency) {
        return new Money(0, currency);
    }
    static fromJSON(json) {
        return new Money(json.amountMinor, json.currency);
    }
    isZero() {
        return this.amountMinor === 0;
    }
    isNegative() {
        return this.amountMinor < 0;
    }
    isPositive() {
        return this.amountMinor > 0;
    }
    assertSameCurrency(other) {
        if (this.currency !== other.currency) {
            throw new InvalidCurrencyError(this.currency, other.currency);
        }
    }
    add(other) {
        this.assertSameCurrency(other);
        return new Money(this.amountMinor + other.amountMinor, this.currency);
    }
    subtract(other) {
        this.assertSameCurrency(other);
        return new Money(this.amountMinor - other.amountMinor, this.currency);
    }
    /**
     * Resta asegurando un mínimo de 0 (útil para descuentos).
     */
    subtractClampedZero(other) {
        this.assertSameCurrency(other);
        return new Money(Math.max(0, this.amountMinor - other.amountMinor), this.currency);
    }
    multiply(factor) {
        if (!Number.isFinite(factor)) {
            throw new DomainError('INVALID_MULTIPLIER', `Factor no válido: ${factor}`);
        }
        return new Money(Math.round(this.amountMinor * factor), this.currency);
    }
    percentage(percent) {
        if (!Number.isFinite(percent) || percent < 0) {
            throw new DomainError('INVALID_PERCENTAGE', `Porcentaje no válido: ${percent}`);
        }
        return new Money(Math.round((this.amountMinor * percent) / 100), this.currency);
    }
    min(other) {
        this.assertSameCurrency(other);
        return this.amountMinor <= other.amountMinor ? this : other;
    }
    max(other) {
        this.assertSameCurrency(other);
        return this.amountMinor >= other.amountMinor ? this : other;
    }
    equals(other) {
        return this.currency === other.currency && this.amountMinor === other.amountMinor;
    }
    greaterThan(other) {
        this.assertSameCurrency(other);
        return this.amountMinor > other.amountMinor;
    }
    greaterThanOrEqual(other) {
        this.assertSameCurrency(other);
        return this.amountMinor >= other.amountMinor;
    }
    lessThan(other) {
        this.assertSameCurrency(other);
        return this.amountMinor < other.amountMinor;
    }
    toMajor(decimals = 2) {
        return this.amountMinor / 10 ** decimals;
    }
    format(locale = 'es-ES', decimals = 2) {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: this.currency,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(this.toMajor(decimals));
    }
    toJSON() {
        return {
            amountMinor: this.amountMinor,
            currency: this.currency,
        };
    }
}
//# sourceMappingURL=money.js.map