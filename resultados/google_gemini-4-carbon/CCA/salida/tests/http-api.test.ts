import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { createShoppingCartApp, type ShoppingCartApp } from '../src/server.ts';

describe('API HTTP End-to-End', () => {
  let app: ShoppingCartApp;
  let baseUrl: string;

  before(async () => {
    app = createShoppingCartApp({ sqlitePath: ':memory:' });
    await new Promise<void>((resolve) => {
      app.server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = app.server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await app.close();
  });

  it('expone healthcheck, catálogo e interfaz web interactiva', async () => {
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);
    const health = (await healthRes.json()) as { status: string };
    assert.equal(health.status, 'ok');

    const prodRes = await fetch(`${baseUrl}/api/v1/products`);
    assert.equal(prodRes.status, 200);
    const prodData = (await prodRes.json()) as { products: unknown[] };
    assert.ok(prodData.products.length >= 6);

    const uiRes = await fetch(`${baseUrl}/`);
    assert.equal(uiRes.status, 200);
    assert.match(uiRes.headers.get('content-type') ?? '', /text\/html/);
  });

  it('completa flujo completo: carrito invitado -> ETag/If-Match -> fusión con usuario -> cupón -> checkout', async () => {
    // 1. Crear carrito de invitado y añadir un ratón
    const guestCreate = await fetch(`${baseUrl}/api/v1/carts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'sess_web_999' }),
    });
    assert.equal(guestCreate.status, 201);
    assert.equal(guestCreate.headers.get('etag'), 'W/"v1"');
    const guestCartId = ((await guestCreate.json()) as { cart: { id: string } }).cart.id;

    const addGuestItem = await fetch(`${baseUrl}/api/v1/carts/${guestCartId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': 'W/"v1"',
        'Idempotency-Key': 'idem-guest-add-1',
      },
      body: JSON.stringify({ sku: 'MOUSE-ERGO-WL', quantity: 2 }),
    });
    assert.equal(addGuestItem.status, 200);
    assert.equal(addGuestItem.headers.get('etag'), 'W/"v2"');

    // Verificar rechazo de ETag obsoleto (409 Conflict)
    const staleAttempt = await fetch(`${baseUrl}/api/v1/carts/${guestCartId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': 'W/"v1"',
      },
      body: JSON.stringify({ sku: 'MECH-KEY-ES', quantity: 1 }),
    });
    assert.equal(staleAttempt.status, 409);

    // 2. El usuario ya tenía un carrito previo con 1 ratón y 1 teclado
    const userCreate = await fetch(`${baseUrl}/api/v1/carts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr_maria' }),
    });
    const userCartId = ((await userCreate.json()) as { cart: { id: string } }).cart.id;

    await fetch(`${baseUrl}/api/v1/carts/${userCartId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: 'MOUSE-ERGO-WL', quantity: 1 }),
    });
    await fetch(`${baseUrl}/api/v1/carts/${userCartId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: 'MECH-KEY-ES', quantity: 1 }),
    });

    // 3. El usuario inicia sesión -> fusionamos carrito invitado dentro de usr_maria
    const mergeRes = await fetch(`${baseUrl}/api/v1/carts/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-merge-maria',
      },
      body: JSON.stringify({ guestCartId, userId: 'usr_maria' }),
    });
    assert.equal(mergeRes.status, 200);
    const mergedBody = (await mergeRes.json()) as {
      cart: { id: string; items: Array<{ sku: string; quantity: number }> };
    };
    assert.equal(mergedBody.cart.id, userCartId);
    const mergedMouse = mergedBody.cart.items.find((i) => i.sku === 'MOUSE-ERGO-WL');
    assert.equal(mergedMouse?.quantity, 3); // 1 del usuario + 2 del invitado

    // 4. Aplicar cupón AHORRA25
    const couponRes = await fetch(`${baseUrl}/api/v1/carts/${userCartId}/coupons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'AHORRA25' }),
    });
    assert.equal(couponRes.status, 200);
    const couponBody = (await couponRes.json()) as {
      cart: { couponCode: string; pricing: { discountTotal: { amountMinor: number } } };
    };
    assert.equal(couponBody.cart.couponCode, 'AHORRA25');
    assert.equal(couponBody.cart.pricing.discountTotal.amountMinor, 2500);

    // 5. Checkout idempotente
    const checkoutRes = await fetch(`${baseUrl}/api/v1/carts/${userCartId}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-checkout-maria',
      },
      body: JSON.stringify({
        customerEmail: 'maria@ejemplo.com',
        shippingAddress: 'Calle Alcalá 100, Madrid',
      }),
    });
    assert.equal(checkoutRes.status, 200);
    const checkoutData = (await checkoutRes.json()) as {
      order: { orderId: string };
      cart: { status: string };
    };
    assert.match(checkoutData.order.orderId, /^ord_/);
    assert.equal(checkoutData.cart.status, 'CHECKED_OUT');

    // Reintentar el mismo checkout con la misma Idempotency-Key devuelve exactamente la misma orden
    const replayCheckout = await fetch(`${baseUrl}/api/v1/carts/${userCartId}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-checkout-maria',
      },
      body: JSON.stringify({
        customerEmail: 'maria@ejemplo.com',
        shippingAddress: 'Calle Alcalá 100, Madrid',
      }),
    });
    assert.equal(replayCheckout.status, 200);
    assert.equal(replayCheckout.headers.get('x-idempotent-replay'), 'true');
    const replayData = (await replayCheckout.json()) as { order: { orderId: string } };
    assert.equal(replayData.order.orderId, checkoutData.order.orderId);

    // 6. Verificar publicación de eventos de dominio
    const eventsRes = await fetch(`${baseUrl}/api/v1/events`);
    const eventsData = (await eventsRes.json()) as { events: Array<{ type: string }> };
    assert.ok(eventsData.events.some((e) => e.type === 'cart.checked_out'));
  });
});
