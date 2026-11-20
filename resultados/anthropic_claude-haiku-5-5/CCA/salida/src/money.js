import { CartError, ErrorCodes } from './errors.js';

/**
 * Todos los importes se manejan como enteros en la unidad menor de la moneda
 * (céntimos para EUR/USD, yenes para JPY...). Nunca se usan floats para dinero.
 */

/** @param {unknown} value @param {string} [name] @returns {number} */
export function assertCents(value, name = 'amount') {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CartError(
      ErrorCodes.INVALID_AMOUNT,
      `${name} must be a non-negative safe integer (minor units)`,
    );
  }
  return value;
}

/** @param {unknown} currency @returns {string} */
export function assertCurrency(currency) {
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
    throw new CartError(ErrorCodes.INVALID_CURRENCY, `invalid ISO 4217 currency: ${currency}`);
  }
  return currency;
}

/**
 * Número de decimales de una moneda según Intl (EUR→2, JPY→0, BHD→3...).
 * @param {string} currency
 */
export function minorUnitDigits(currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits;
}

/**
 * Formatea un importe en céntimos para mostrarlo al usuario.
 * @param {number} cents
 * @param {string} currency
 * @param {string} [locale]
 */
export function formatMoney(cents, currency, locale = 'es-ES') {
  const digits = minorUnitDigits(currency);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    cents / 10 ** digits,
  );
}

/**
 * Aplica un porcentaje expresado en puntos básicos (1 bp = 0.01%) a un importe
 * y redondea al entero más cercano (mitad hacia arriba).
 * @param {number} amountCents
 * @param {number} bps
 */
export function applyBps(amountCents, bps) {
  return Math.round((amountCents * bps) / 10000);
}
