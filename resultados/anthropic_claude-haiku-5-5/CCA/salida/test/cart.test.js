import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as cart from '../src/cart.js';
import { CartError, ErrorCodes } from '../src/errors.js';

const apple = { sku: 'APPLE', name: 'Manzana', unitPriceCents: 150, currency: 'EUR' };
const bread = { sku: 'BREAD', name: 'Pan', unitPriceCents: 299, currency: 'EUR' };

const expectCode = (code) => (err) => err instanceof CartError && err.code === code;

describe('cart domain', () => {
  test('createCart valida id y moneda', () => {
    const c = cart.createCart({ id: 'c-1', currency: 'EUR' });
    assert.equal(c.id, 'c-1');
    assert.equal(c.currency, 'EUR');
    assert.deepEqual(c.lines, []);
    assert.throws(() => cart.createCart({ id: 'bad id!', currency: 'EUR' }), expectCode(ErrorCodes.INVALID_CART_ID));
    assert.throws(() => cart.createCart({ id: 'x', currency: 'euro' }), expectCode(ErrorCodes.INVALID_CURRENCY));
  });

  test('addItem añade líneas y acumula cantidades del mismo SKU', () => {
    let c = cart.createCart({ id: 'c', currency: 'EUR' });
    c = cart.addItem(c, apple, 2);
    c = cart.addItem(c, apple);
    c = cart.addItem(c, bread);
    assert.equal(c.lines.length, 2);
    assert.equal(c.lines[0].quantity, 3);
    assert.equal(cart.subtotalCents(c), 3 * 150 + 299);
    assert.equal(cart.itemCount(c), 4);
  });

  test('las operaciones son inmutables', () => {
    const c0 = cart.createCart({ id: 'c', currency: 'EUR' });
    const c1 = cart.addItem(c0, apple, 1);
    assert.equal(c0.lines.length, 0);
    assert.equal(c1.lines.length, 1);
    assert.ok(Object.isFrozen(c1));
    assert.ok(Object.isFrozen(c1.lines));
    assert.throws(() => c1.lines.push({}), TypeError);
  });

  test('rechaza cantidades inválidas', () => {
    const c = cart.createCart({ id: 'c', currency: 'EUR' });
    for (const q of [0, -1, 1.5, NaN, '2']) {
      assert.throws(() => cart.addItem(c, apple, q), expectCode(ErrorCodes.INVALID_QUANTITY), `q=${q}`);
    }
  });

  test('respeta el límite por línea', () => {
    const c = cart.addItem(cart.createCart({ id: 'c', currency: 'EUR' }), apple, 99);
    assert.throws(() => cart.addItem(c, apple, 1), expectCode(ErrorCodes.QUANTITY_LIMIT_EXCEEDED));
  });

  test('respeta el límite de líneas por carrito', () => {
    const limits = { maxLines: 1, maxQuantityPerLine: 99 };
    const c = cart.addItem(cart.createCart({ id: 'c', currency: 'EUR' }), apple, 1, limits);
    assert.throws(() => cart.addItem(c, bread, 1, limits), expectCode(ErrorCodes.CART_FULL));
    // Sumar a una línea existente sigue permitido aunque el carrito esté lleno.
    assert.equal(cart.addItem(c, apple, 1, limits).lines[0].quantity, 2);
  });

  test('rechaza moneda distinta a la del carrito', () => {
    const c = cart.createCart({ id: 'c', currency: 'USD' });
    assert.throws(() => cart.addItem(c, apple, 1), expectCode(ErrorCodes.CURRENCY_MISMATCH));
  });

  test('rechaza productos mal formados', () => {
    const c = cart.createCart({ id: 'c', currency: 'EUR' });
    assert.throws(() => cart.addItem(c, { ...apple, sku: '' }), expectCode(ErrorCodes.INVALID_PRODUCT));
    assert.throws(() => cart.addItem(c, { ...apple, unitPriceCents: 1.99 }), expectCode(ErrorCodes.INVALID_AMOUNT));
    assert.throws(() => cart.addItem(c, { ...apple, unitPriceCents: -1 }), expectCode(ErrorCodes.INVALID_AMOUNT));
  });

  test('setQuantity fija cantidad; 0 elimina; SKU inexistente falla', () => {
    let c = cart.addItem(cart.createCart({ id: 'c', currency: 'EUR' }), apple, 1);
    c = cart.setQuantity(c, 'APPLE', 5);
    assert.equal(c.lines[0].quantity, 5);
    c = cart.setQuantity(c, 'APPLE', 0);
    assert.equal(c.lines.length, 0);
    assert.throws(() => cart.setQuantity(c, 'NOPE', 1), expectCode(ErrorCodes.ITEM_NOT_FOUND));
  });

  test('removeItem es idempotente y clear vacía el carrito', () => {
    let c = cart.addItem(cart.createCart({ id: 'c', currency: 'EUR' }), apple, 1);
    const same = cart.removeItem(c, 'NOPE');
    assert.equal(same, c);
    c = cart.removeItem(c, 'APPLE');
    assert.equal(c.lines.length, 0);
    c = cart.addItem(c, bread, 2);
    assert.equal(cart.clear(c).lines.length, 0);
  });
});
