import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { signToken } from '../../src/http/auth.js';

let harness: TestApp;
let app: FastifyInstance;

const GUEST = { 'x-session-id': 'sesion-invitado-1' };
const USER_TOKEN = signToken('usuario-1', 'dev-secret-change-me', 'carrito-escalable');
const OTHER_USER_TOKEN = signToken('usuario-2', 'dev-secret-change-me', 'carrito-escalable');
const AUTH = { authorization: `Bearer ${USER_TOKEN}` };

async function createCart(headers: Record<string, string> = GUEST) {
  const response = await app.inject({ method: 'POST', url: '/v1/carts', headers, payload: {} });
  expect(response.statusCode).toBe(201);
  return response.json() as { id: string; version: number };
}

beforeAll(async () => {
  harness = await createTestApp();
  app = harness.app;
});

afterAll(async () => {
  await harness.close();
});

describe('API del carrito', () => {
  it('crea un carrito de invitado y lo devuelve con su ETag', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/carts',
      headers: GUEST,
      payload: {},
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers.etag).toBe('"1"');
    const cart = response.json();
    expect(cart.items).toEqual([]);
    expect(cart.totals.totalCents).toBe(0);
    expect(cart.ownerId).toBeNull();
  });

  it('añade un artículo y calcula los totales en el servidor', async () => {
    const cart = await createCart();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/items`,
      headers: GUEST,
      payload: { productId: 'prod-tea', quantity: 3 },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quantity).toBe(3);
    // 3 x 12,90 € con un 5 % de descuento por volumen
    expect(body.totals.subtotalCents).toBe(3_870);
    expect(body.totals.discountCents).toBe(193);
    expect(body.totals.shippingCents).toBe(499);
    expect(body.totals.taxCents).toBe(876);
    expect(body.totals.totalCents).toBe(5_052);
    expect(body.version).toBe(2);
  });

  it('ignora el precio enviado por el cliente', async () => {
    const cart = await createCart();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/items`,
      headers: GUEST,
      payload: { productId: 'prod-tea', quantity: 1, unitPriceCents: 1, price: 0.01 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items[0].unitPriceCents).toBe(1_290);
  });

  it('devuelve 404 cuando el producto no existe', async () => {
    const cart = await createCart();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/items`,
      headers: GUEST,
      payload: { productId: 'no-existe', quantity: 1 },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('devuelve 409 si se reintenta con una versión obsoleta', async () => {
    const cart = await createCart();
    await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/items`,
      headers: GUEST,
      payload: { productId: 'prod-tea', quantity: 1 },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/items`,
      headers: { ...GUEST, 'if-match': '"1"' },
      payload: { productId: 'prod-mug', variantId: 'var-blue', quantity: 1 },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('CART_VERSION_CONFLICT');
    expect(response.json().error.details.actualVersion).toBe(2);
  });

  it('acepta la versión actual y actualiza el ETag', async () => {
    const cart = await createCart();
    await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/items`,
      headers: GUEST,
      payload: { productId: 'prod-tea', quantity: 1 },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/items`,
      headers: { ...GUEST, 'if-match': '"2"' },
      payload: { productId: 'prod-mug', variantId: 'var-blue', quantity: 1 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers.etag).toBe('"3"');
    expect(response.json().items).toHaveLength(2);
  });

  it('reproduce la respuesta cuando se repite la Idempotency-Key', async () => {
    const cart = await createCart();
    const headers = { ...GUEST, 'idempotency-key': 'clave-1' };

    const first = await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/items`,
      headers,
      payload: { productId: 'prod-tea', quantity: 2 },
    });
    const second = await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/items`,
      headers,
      payload: { productId: 'prod-tea', quantity: 2 },
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.headers['idempotent-replay']).toBe('true');
    expect(second.json()).toEqual(first.json());

    const current = await app.inject({
      method: 'GET',
      url: `/v1/carts/${cart.id}`,
      headers: GUEST,
    });
    expect(current.json().items[0].quantity).toBe(2);
  });

  it('aplica y retira un cupón promocional', async () => {
    const cart = await createCart();
    await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/items`,
      headers: GUEST,
      payload: { productId: 'prod-lamp', quantity: 1 },
    });

    const applied = await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/promos`,
      headers: GUEST,
      payload: { code: 'WELCOME10' },
    });
    expect(applied.statusCode).toBe(200);
    expect(applied.json().totals.promoCents).toBe(499);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/v1/carts/${cart.id}/promos/WELCOME10`,
      headers: GUEST,
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().totals.promoCents).toBe(0);
  });

  it('rechaza un cupón inexistente', async () => {
    const cart = await createCart();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/promos`,
      headers: GUEST,
      payload: { code: 'NOEXISTE' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('PROMO_NOT_FOUND');
  });

  it('impide que otro usuario toque el carrito', async () => {
    const cart = await createCart({ ...AUTH, 'x-session-id': 'sesion-usuario-1' });
    const response = await app.inject({
      method: 'GET',
      url: `/v1/carts/${cart.id}`,
      headers: { authorization: `Bearer ${OTHER_USER_TOKEN}` },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('devuelve 404 para un carrito inexistente', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/carts/00000000-0000-0000-0000-000000000000',
      headers: GUEST,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('CART_NOT_FOUND');
  });

  it('fusiona el carrito de invitado con el del usuario al iniciar sesión', async () => {
    const guest = await createCart();
    await app.inject({
      method: 'POST',
      url: `/v1/carts/${guest.id}/items`,
      headers: GUEST,
      payload: { productId: 'prod-tea', quantity: 2 },
    });

    const userCart = await createCart({ ...AUTH, 'x-session-id': 'sesion-usuario-1' });
    await app.inject({
      method: 'POST',
      url: `/v1/carts/${userCart.id}/items`,
      headers: { ...AUTH, 'x-session-id': 'sesion-usuario-1' },
      payload: { productId: 'prod-notebook', quantity: 1 },
    });

    const merged = await app.inject({
      method: 'POST',
      url: `/v1/carts/${userCart.id}/merge`,
      // tras el login el navegador conserva la cookie de sesión de invitado
      headers: { ...AUTH, 'x-session-id': 'sesion-invitado-1' },
      payload: { sourceCartId: guest.id },
    });

    expect(merged.statusCode).toBe(200);
    const body = merged.json();
    expect(body.items).toHaveLength(2);
    expect(body.items.find((i: { productId: string }) => i.productId === 'prod-tea').quantity).toBe(2);

    const guestAfter = await app.inject({
      method: 'GET',
      url: `/v1/carts/${guest.id}`,
      headers: GUEST,
    });
    expect(guestAfter.statusCode).toBe(404);
  });

  it('cierra el carrito y bloquea nuevas mutaciones', async () => {
    const cart = await createCart();
    await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/items`,
      headers: GUEST,
      payload: { productId: 'prod-tea', quantity: 1 },
    });

    const checkout = await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/checkout`,
      headers: GUEST,
      payload: {},
    });
    expect(checkout.statusCode).toBe(200);
    expect(checkout.json().status).toBe('checked_out');

    const afterwards = await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/items`,
      headers: GUEST,
      payload: { productId: 'prod-tea', quantity: 1 },
    });
    expect(afterwards.statusCode).toBe(409);
    expect(afterwards.json().error.code).toBe('CART_ALREADY_CHECKED_OUT');
  });

  it('no permite superar el stock disponible', async () => {
    const cart = await createCart();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/carts/${cart.id}/items`,
      headers: GUEST,
      payload: { productId: 'prod-lamp', quantity: 50 },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('OUT_OF_STOCK');
  });

  it('expone health, readiness y métricas', async () => {
    const health = await app.inject({ method: 'GET', url: '/healthz' });
    expect(health.statusCode).toBe(200);

    const ready = await app.inject({ method: 'GET', url: '/readyz' });
    expect(ready.statusCode).toBe(200);

    const metrics = await app.inject({ method: 'GET', url: '/metrics' });
    expect(metrics.statusCode).toBe(200);
    expect(metrics.body).toContain('cart_http_requests_total');
  });
});
