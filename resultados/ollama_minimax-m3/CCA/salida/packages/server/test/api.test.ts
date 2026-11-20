import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestContext } from './helpers.js';
import type { Container } from '../src/container.js';

interface MoneyDto {
  amount: number;
  currency: string;
}

interface CartResponse {
  cart: {
    id: string;
    version: number;
    customerId: string | null;
    lines: { productId: string; quantity: number; unitPrice: MoneyDto }[];
    coupons: { code: string }[];
  };
  totals: {
    subtotal: MoneyDto;
    discountTotal: MoneyDto;
    shipping: MoneyDto;
    tax: MoneyDto;
    total: MoneyDto;
    unitCount: number;
  };
}

const CUSTOMER = 'customer-1';

describe('cart API', () => {
  let app: FastifyInstance;
  let container: Container;

  beforeAll(async () => {
    const context = await createTestContext();
    app = context.app;
    container = context.container;
  });

  afterAll(async () => {
    await app.close();
  });

  const createCart = async (headers: Record<string, string> = {}): Promise<CartResponse> => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/carts', headers });
    expect(response.statusCode).toBe(201);
    return response.json() as CartResponse;
  };

  it('creates an empty cart', async () => {
    const body = await createCart({ 'x-customer-id': CUSTOMER });

    expect(body.cart.customerId).toBe(CUSTOMER);
    expect(body.cart.version).toBe(0);
    expect(body.cart.lines).toHaveLength(0);
    expect(body.totals.total.amount).toBe(0);
  });

  it('adds a product and computes the totals', async () => {
    const { cart } = await createCart({ 'x-customer-id': CUSTOMER });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers: { 'x-customer-id': CUSTOMER },
      payload: { productId: 'sku-espresso', quantity: 2 },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as CartResponse;

    expect(body.cart.lines).toHaveLength(1);
    expect(body.cart.lines[0]?.quantity).toBe(2);
    // 12.90 x 2 = 25.80
    expect(body.totals.subtotal.amount).toBe(2580);
    // shipping 4.99
    expect(body.totals.shipping.amount).toBe(499);
    // taxable base = 2580 + 499 = 3079 -> tax 21% = 647 (646.59 rounded)
    expect(body.totals.tax.amount).toBe(647);
    expect(body.totals.total.amount).toBe(3726);
    expect(body.cart.version).toBe(1);
  });

  it('merges the quantities when the same product is added twice', async () => {
    const { cart } = await createCart({ 'x-customer-id': CUSTOMER });

    await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers: { 'x-customer-id': CUSTOMER },
      payload: { productId: 'sku-bolas', quantity: 1 },
    });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers: { 'x-customer-id': CUSTOMER },
      payload: { productId: 'sku-bolas', quantity: 3 },
    });

    const body = response.json() as CartResponse;
    expect(body.cart.lines).toHaveLength(1);
    expect(body.cart.lines[0]?.quantity).toBe(4);
  });

  it('adds several products atomically', async () => {
    const { cart } = await createCart({ 'x-customer-id': CUSTOMER });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers: { 'x-customer-id': CUSTOMER },
      payload: {
        items: [
          { productId: 'sku-espresso', quantity: 1 },
          { productId: 'sku-taza', quantity: 2 },
        ],
      },
    });

    const body = response.json() as CartResponse;
    expect(body.cart.lines).toHaveLength(2);
    expect(body.totals.unitCount).toBe(3);
  });

  it('rejects the whole batch when one product does not exist', async () => {
    const { cart } = await createCart({ 'x-customer-id': CUSTOMER });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers: { 'x-customer-id': CUSTOMER },
      payload: {
        items: [
          { productId: 'sku-espresso', quantity: 1 },
          { productId: 'does-not-exist', quantity: 1 },
        ],
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('PRODUCT_NOT_FOUND');

    const after = await app.inject({
      method: 'GET',
      url: `/api/v1/carts/${cart.id}`,
      headers: { 'x-customer-id': CUSTOMER },
    });
    expect((after.json() as CartResponse).cart.lines).toHaveLength(0);
  });

  it('updates and removes lines', async () => {
    const { cart } = await createCart({ 'x-customer-id': CUSTOMER });
    await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers: { 'x-customer-id': CUSTOMER },
      payload: { productId: 'sku-molinillo', quantity: 1 },
    });

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/v1/carts/${cart.id}/items/sku-molinillo`,
      headers: { 'x-customer-id': CUSTOMER },
      payload: { quantity: 3 },
    });
    expect((updated.json() as CartResponse).cart.lines[0]?.quantity).toBe(3);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/carts/${cart.id}/items/sku-molinillo`,
      headers: { 'x-customer-id': CUSTOMER },
    });
    expect((removed.json() as CartResponse).cart.lines).toHaveLength(0);
  });

  it('applies and removes a coupon', async () => {
    const { cart } = await createCart({ 'x-customer-id': CUSTOMER });
    await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers: { 'x-customer-id': CUSTOMER },
      payload: { productId: 'sku-tostado', quantity: 1 },
    });

    const applied = await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/coupons`,
      headers: { 'x-customer-id': CUSTOMER },
      payload: { code: 'BIENVENIDA10' },
    });

    const body = applied.json() as CartResponse;
    expect(body.cart.coupons.map((coupon) => coupon.code)).toContain('BIENVENIDA10');
    // 34.50 - 10% (3.45) = 31.05
    expect(body.totals.subtotal.amount).toBe(3450);
    expect(body.totals.couponDiscount.amount).toBe(345);
    expect(body.totals.discountTotal.amount).toBe(345);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/carts/${cart.id}/coupons/BIENVENIDA10`,
      headers: { 'x-customer-id': CUSTOMER },
    });
    expect((removed.json() as CartResponse).cart.coupons).toHaveLength(0);
  });

  it('rejects an unknown coupon', async () => {
    const { cart } = await createCart({ 'x-customer-id': CUSTOMER });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/coupons`,
      headers: { 'x-customer-id': CUSTOMER },
      payload: { code: 'NOPE' },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('COUPON_INVALID');
  });

  it('protects the cart of another customer', async () => {
    const { cart } = await createCart({ 'x-customer-id': CUSTOMER });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/carts/${cart.id}`,
      headers: { 'x-customer-id': 'someone-else' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for an unknown cart', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/carts/does-not-exist' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('CART_NOT_FOUND');
  });

  it('validates the payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/carts/some-cart/items',
      payload: { productId: 'sku-espresso', quantity: 0 },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('replays an idempotent request instead of executing it twice', async () => {
    const { cart } = await createCart({ 'x-customer-id': CUSTOMER });
    const headers = {
      'x-customer-id': CUSTOMER,
      'idempotency-key': 'key-123',
    };

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers,
      payload: { productId: 'sku-bolas', quantity: 2 },
    });
    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers,
      payload: { productId: 'sku-bolas', quantity: 2 },
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.headers['idempotent-replay']).toBe('true');
    expect(first.json()).toEqual(second.json());

    const current = await app.inject({
      method: 'GET',
      url: `/api/v1/carts/${cart.id}`,
      headers: { 'x-customer-id': CUSTOMER },
    });
    expect((current.json() as CartResponse).cart.lines[0]?.quantity).toBe(2);
  });

  it('rejects the reuse of an idempotency key with a different payload', async () => {
    const { cart } = await createCart({ 'x-customer-id': CUSTOMER });
    const headers = {
      'x-customer-id': CUSTOMER,
      'idempotency-key': 'key-456',
    };

    await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers,
      payload: { productId: 'sku-bolas', quantity: 1 },
    });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers,
      payload: { productId: 'sku-bolas', quantity: 7 },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('merges a guest cart into the customer cart', async () => {
    const guest = await createCart();
    expect(guest.cart.customerId).toBeNull();

    await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${guest.cart.id}/items`,
      payload: { productId: 'sku-bolas', quantity: 2 },
    });

    const customer = await createCart({ 'x-customer-id': CUSTOMER });
    await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${customer.cart.id}/items`,
      headers: { 'x-customer-id': CUSTOMER },
      payload: { productId: 'sku-bolas', quantity: 1 },
    });

    const merged = await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${customer.cart.id}/merge`,
      headers: { 'x-customer-id': CUSTOMER },
      payload: { sourceCartId: guest.cart.id },
    });

    expect(merged.statusCode).toBe(200);
    const body = merged.json() as CartResponse;
    expect(body.cart.lines).toHaveLength(1);
    expect(body.cart.lines[0]?.quantity).toBe(3);
    expect(body.cart.customerId).toBe(CUSTOMER);
  });

  it('checks out and reserves the stock', async () => {
    const { cart } = await createCart({ 'x-customer-id': CUSTOMER });
    await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/items`,
      headers: { 'x-customer-id': CUSTOMER },
      payload: { productId: 'sku-varietal', quantity: 1 },
    });

    const checkout = await app.inject({
      method: 'POST',
      url: `/api/v1/carts/${cart.id}/checkout`,
      headers: { 'x-customer-id': CUSTOMER },
    });

    expect(checkout.statusCode).toBe(200);
    const body = checkout.json() as CartResponse & { reservationId: string };
    expect(body.reservationId).toBeTruthy();
    expect(body.cart.status).toBe('converted');

    const available = await container.stock.available('sku-varietal');
    expect(available).toBe(7);
  });

  it('lists the products of the catalogue', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/products' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { products: { id: string; price: MoneyDto }[] };
    expect(body.products.length).toBeGreaterThan(0);
    expect(body.products[0]?.price.amount).toBeGreaterThan(0);
  });

  it('exposes the health and the metrics endpoints', async () => {
    const live = await app.inject({ method: 'GET', url: '/health/live' });
    expect(live.statusCode).toBe(200);

    const ready = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(ready.statusCode).toBe(200);

    const metrics = await app.inject({ method: 'GET', url: '/metrics' });
    expect(metrics.statusCode).toBe(200);
    expect(metrics.body).toContain('http_requests_total');
  });
});
