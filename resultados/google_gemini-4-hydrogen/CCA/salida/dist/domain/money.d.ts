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
export declare class Money {
    readonly amountMinor: number;
    readonly currency: CurrencyCode;
    private constructor();
    static fromMinor(amountMinor: number, currency: CurrencyCode): Money;
    static fromMajor(amountMajor: number, currency: CurrencyCode, decimals?: number): Money;
    static zero(currency: CurrencyCode): Money;
    static fromJSON(json: MoneyJSON): Money;
    isZero(): boolean;
    isNegative(): boolean;
    isPositive(): boolean;
    assertSameCurrency(other: Money): void;
    add(other: Money): Money;
    subtract(other: Money): Money;
    /**
     * Resta asegurando un mínimo de 0 (útil para descuentos).
     */
    subtractClampedZero(other: Money): Money;
    multiply(factor: number): Money;
    percentage(percent: number): Money;
    min(other: Money): Money;
    max(other: Money): Money;
    equals(other: Money): boolean;
    greaterThan(other: Money): boolean;
    greaterThanOrEqual(other: Money): boolean;
    lessThan(other: Money): boolean;
    toMajor(decimals?: number): number;
    format(locale?: string, decimals?: number): string;
    toJSON(): MoneyJSON;
}
//# sourceMappingURL=money.d.ts.map