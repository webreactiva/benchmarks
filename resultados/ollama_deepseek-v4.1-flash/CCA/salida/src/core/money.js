export function toCents(value) {
  return Math.round(Number(value) * 100);
}

export function fromCents(cents) {
  return Number(cents) / 100;
}

export function formatMoney(cents, { currency = 'EUR', locale = 'es-ES' } = {}) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format((Number(cents) || 0) / 100);
}
