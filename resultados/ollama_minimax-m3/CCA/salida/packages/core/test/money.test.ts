import { describe, expect, it } from 'vitest';
import {
  InvalidMoneyError,
  add,
  applyRate,
  money,
  moneyFromDecimal,
  multiply,
  subtract,
  sumMoney,
} from '../src/domain/money.js';

describe('money', () => {
  it('stores the amount in minor units', () => {
    expect(money(1290, 'EUR')).toEqual({ amount: 1290, currency: 'EUR' });
  });

  it('normalises the currency code', () => {
    expect(money(100, 'eur').currency).toBe('EUR');
  });

  it('rejects non integer amounts', () => {
    expect(() => money(12.5, 'EUR')).toThrow(InvalidMoneyError);
  });

  it('rejects invalid currency codes', () => {
    expect(() => money(100, 'EURO')).toThrow(InvalidMoneyError);
    expect(() => money(100, '')).toThrow(InvalidMoneyError);
  });

  it('adds and subtracts amounts of the same currency', () => {
    expect(add(money(100, 'EUR'), money(250, 'EUR')).amount).toBe(350);
    expect(subtract(money(100, 'EUR'), money(250, 'EUR')).amount).toBe(-150);
  });

  it('refuses to mix currencies', () => {
    expect(() => add(money(100, 'EUR'), money(100, 'USD'))).toThrow(InvalidMoneyError);
  });

  it('multiplies by an integer quantity', () => {
    expect(multiply(money(1290, 'EUR'), 3).amount).toBe(3870);
    expect(() => multiply(money(1290, 'EUR'), 1.5)).toThrow(InvalidMoneyError);
  });

  it('rounds the rate half up', () => {
    expect(applyRate(money(3079, 'EUR'), 0.21).amount).toBe(647);
    expect(applyRate(money(100, 'EUR'), 0.5).amount).toBe(50);
    expect(applyRate(money(101, 'EUR'), 0.5).amount).toBe(51);
  });

  it('converts decimal values without losing cents', () => {
    expect(moneyFromDecimal(12.34, 'EUR').amount).toBe(1234);
    expect(moneyFromDecimal(0.1, 'EUR').amount).toBe(10);
  });

  it('sums an empty list to zero', () => {
    expect(sumMoney([], 'EUR').amount).toBe(0);
  });
});
