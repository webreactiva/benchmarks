export type Currency = 'EUR' | 'USD' | 'GBP';

export const ZERO: Readonly<Record<Currency, number>> = Object.freeze({
  EUR: 0,
  USD: 0,
  GBP: 0,
});

/**
 * Todo el dinero del dominio se expresa en unidades menores (céntimos) como
 * enteros. Nunca se usan floats para dinero: evita errores de redondeo y
 * mantiene paridad exacta entre TypeScript y el script Lua que replica el
 * cálculo en Redis.
 */
export function assertMinorUnits(value: number, field = 'amount'): number {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${field} debe ser un entero en unidades menores (céntimos)`);
  }
  return value;
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Aplica un porcentaje en puntos basicos (basis points) redondeando hacia abajo. */
export function applyBps(amount: number, bps: number): number {
  if (bps <= 0) return 0;
  return Math.floor((amount * bps) / 10_000);
}

export function formatMoney(amount: number, currency: Currency): string {
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '£';
  return `${symbol}${(amount / 100).toFixed(2)}`;
}
