// El dinero se representa SIEMPRE en unidades mínimas enteras (céntimos)
// para evitar errores de coma flotante (0.1 + 0.2 !== 0.3).

import { ValidationError } from './errors.js';

export function assertCents(value, field = 'importe') {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError(`${field} debe ser un entero no negativo en céntimos`, { field, value });
  }
  return value;
}

/** Porcentaje aplicado a un importe, redondeo "half-up". `percent` admite decimales (21, 10.5...). */
export function percentOf(cents, percent) {
  return Math.round((cents * percent) / 100);
}

export function formatMoney(cents, currency = 'EUR', locale = 'es-ES') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}
