import { describe, expect, it } from 'vitest';
import {
  addLine,
  applyCoupon,
  cartSubtotal,
  clearLines,
  createCart,
  findLine,
  mergeCarts,
  removeLine,
  setLineQuantity,
  type Cart,
} from '../src/domain/cart.js';
import { defaultCartPolicies, mergePolicies } from '../src/domain/policies.js';
import { money } from '../src/domain/money.js';
import { CartLimitExceededError, InvalidQuantityError } from '../src/domain/errors.js';

const NOW = '2024-01-01T00:00:00.000Z';

const baseCart = (): Cart =>
  createCart({ id: 'cart-1', customerId: 'customer-1', currency: 'EUR', now: NOW });

const product = {
  productId: 'p1',
  sku: 'SKU-1',
  name: 'Producto',
  unitPrice: money(1000, 'EUR'),
  quantity: 1,
  lineId: 'line-1',
};

describe('cart domain', () => {
  it('starts empty and active', () => {
    const cart = baseCart();
    expect(cart.lines).toHaveLength(0);
    expect(cart.status).toBe('active');
    expect(cart.version).toBe(0);
  });

  it('adds a line', () => {
    const cart = addLine(baseCart(), product, NOW, defaultCartPolicies);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.quantity).toBe(1);
    expect(cartSubtotal(cart).amount).toBe(1000);
  });

  it('merges the quantity when the product is added twice', () => {
    let cart = addLine(baseCart(), product, NOW, defaultCartPolicies);
    cart = addLine(cart, { ...product, lineId: 'line-2', quantity: 2 }, NOW, defaultCartPolicies);

    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.quantity).toBe(3);
    expect(cart.lines[0]?.id).toBe('line-1');
  });

  it('rejects invalid quantities', () => {
    expect(() =>
      addLine(baseCart(), { ...product, quantity: 0 }, NOW, defaultCartPolicies),
    ).toThrow(InvalidQuantityError);
    expect(() =>
      addLine(baseCart(), { ...product, quantity: 1.5 }, NOW, defaultCartPolicies),
    ).toThrow(InvalidQuantityError);
  });

  it('enforces the maximum quantity per line', () => {
    const policies = mergePolicies(defaultCartPolicies, { maxQuantityPerLine: 3 });
    expect(() => addLine(baseCart(), { ...product, quantity: 4 }, NOW, policies)).toThrow(
      CartLimitExceededError,
    );
  });

  it('enforces the maximum number of distinct lines', () => {
    const policies = mergePolicies(defaultCartPolicies, { maxDistinctLines: 1 });
    const cart = addLine(baseCart(), product, NOW, policies);
    expect(() =>
      addLine(cart, { ...product, productId: 'p2', lineId: 'line-2' }, NOW, policies),
    ).toThrow(CartLimitExceededError);
  });

  it('enforces the maximum number of units', () => {
    const policies = mergePolicies(defaultCartPolicies, { maxUnitsPerCart: 2 });
    const cart = addLine(baseCart(), product, NOW, policies);
    expect(() => addLine(cart, { ...product, quantity: 2 }, NOW, policies)).toThrow(
      CartLimitExceededError,
    );
  });

  it('sets an absolute quantity and removes the line when it is zero', () => {
    let cart = addLine(baseCart(), product, NOW, defaultCartPolicies);
    cart = setLineQuantity(cart, 'p1', 5, NOW, defaultCartPolicies);
    expect(findLine(cart, 'p1')?.quantity).toBe(5);

    cart = setLineQuantity(cart, 'p1', 0, NOW, defaultCartPolicies);
    expect(findLine(cart, 'p1')).toBeUndefined();
  });

  it('removes and clears lines', () => {
    let cart = addLine(baseCart(), product, NOW, defaultCartPolicies);
    cart = addLine(
      cart,
      { ...product, productId: 'p2', lineId: 'line-2' },
      NOW,
      defaultCartPolicies,
    );

    cart = removeLine(cart, 'p1', NOW, defaultCartPolicies);
    expect(cart.lines).toHaveLength(1);

    cart = clearLines(cart, NOW);
    expect(cart.lines).toHaveLength(0);
  });

  it('stores the coupons without duplicating them', () => {
    const coupon = {
      code: 'welcome',
      type: 'percentage' as const,
      value: 0.1,
      description: '10%',
      active: true,
    };

    let cart = applyCoupon(baseCart(), coupon, NOW);
    cart = applyCoupon(cart, coupon, NOW);

    expect(cart.coupons).toHaveLength(1);
    expect(cart.coupons[0]?.code).toBe('WELCOME');
  });

  it('merges a guest cart into the customer cart', () => {
    const target = addLine(baseCart(), product, NOW, defaultCartPolicies);
    const source = addLine(
      createCart({ id: 'guest', customerId: null, currency: 'EUR', now: NOW }),
      { ...product, quantity: 2 },
      NOW,
      defaultCartPolicies,
    );

    const { merged, source: converted } = mergeCarts(target, source, NOW, defaultCartPolicies);

    expect(merged.lines).toHaveLength(1);
    expect(merged.lines[0]?.quantity).toBe(3);
    expect(converted.status).toBe('converted');
  });

  it('clamps the merged quantity to the maximum per line', () => {
    const policies = mergePolicies(defaultCartPolicies, { maxQuantityPerLine: 2 });
    const target = addLine(baseCart(), { ...product, quantity: 2 }, NOW, policies);
    const source = addLine(
      createCart({ id: 'guest', customerId: null, currency: 'EUR', now: NOW }),
      { ...product, quantity: 2 },
      NOW,
      policies,
    );

    const { merged } = mergeCarts(target, source, NOW, policies);
    expect(merged.lines[0]?.quantity).toBe(2);
  });

  it('keeps the customer cart id when merging', () => {
    const target = baseCart();
    const source = createCart({ id: 'guest', customerId: null, currency: 'EUR', now: NOW });
    const { merged } = mergeCarts(target, source, NOW, defaultCartPolicies);
    expect(merged.id).toBe('cart-1');
  });
});
