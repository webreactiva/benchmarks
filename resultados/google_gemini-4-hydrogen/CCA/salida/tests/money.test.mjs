import test from 'node:test';
import assert from 'node:assert/strict';
import { InvalidCurrencyError, Money } from '../dist/index.js';

test('Money: evita errores de coma flotante usando unidades mínimas', () => {
  const a = Money.fromMajor(0.1, 'EUR');
  const b = Money.fromMajor(0.2, 'EUR');
  const sum = a.add(b);

  assert.equal(sum.amountMinor, 30);
  assert.equal(sum.toMajor(), 0.3);
  assert.equal(sum.equals(Money.fromMajor(0.3, 'EUR')), true);
});

test('Money: lanza InvalidCurrencyError si se operan monedas distintas', () => {
  const eur = Money.fromMajor(10, 'EUR');
  const usd = Money.fromMajor(10, 'USD');

  assert.throws(() => eur.add(usd), InvalidCurrencyError);
  assert.throws(() => eur.subtract(usd), InvalidCurrencyError);
  assert.throws(() => eur.greaterThan(usd), InvalidCurrencyError);
});

test('Money: porcentaje, resta acotada a cero y serialización JSON', () => {
  const price = Money.fromMajor(100, 'EUR');
  const discount = price.percentage(15);
  assert.equal(discount.amountMinor, 1500);

  const clamped = Money.fromMajor(5, 'EUR').subtractClampedZero(discount);
  assert.equal(clamped.amountMinor, 0);

  const restored = Money.fromJSON(price.toJSON());
  assert.equal(restored.equals(price), true);
});
