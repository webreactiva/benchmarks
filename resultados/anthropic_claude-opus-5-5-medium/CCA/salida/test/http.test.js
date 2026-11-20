import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildContainer } from '../src/container.js';
import { createServer } from '../src/http/server.js';

let server, base;
before(async () => {
  server = createServer(await buildContainer({}));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const call = (method, path, body, headers = {}) =>
  fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });

test('API: ciclo de vida del carrito con ETag/If-Match', async () => {
  let r = await call('POST', '/carts', { ownerId: 'u1' });
  assert.equal(r.status, 201);
  const cart = await r.json();
  assert.equal(r.headers.get('etag'), '"1"');

  r = await call('POST', `/carts/${cart.id}/items`, { sku: 'TAZA-LOGO', quantity: 3 }, { 'if-match': '"1"' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('etag'), '"2"');

  r = await call('POST', `/carts/${cart.id}/items`, { sku: 'TAZA-LOGO' }, { 'if-match': '"1"' });
  assert.equal(r.status, 409);
  assert.equal((await r.json()).error.code, 'VERSION_CONFLICT');

  r = await call('POST', `/carts/${cart.id}/coupons`, { code: 'TAZAS3X2' });
  const v = await r.json();
  assert.equal(v.discountTotal, 800);

  r = await call('PATCH', `/carts/${cart.id}/items/TAZA-LOGO`, { quantity: 1 });
  assert.equal((await r.json()).lines[0].quantity, 1);

  r = await call('DELETE', `/carts/${cart.id}/coupons/TAZAS3X2`);
  assert.equal(r.status, 200);
  r = await call('DELETE', `/carts/${cart.id}/items/TAZA-LOGO`);
  assert.equal((await r.json()).lines.length, 0);

  r = await call('DELETE', `/carts/${cart.id}`);
  assert.equal(r.status, 204);
  r = await call('GET', `/carts/${cart.id}`);
  assert.equal(r.status, 404);
});

test('API: Idempotency-Key evita duplicar una adición', async () => {
  const { id } = await (await call('POST', '/carts', {})).json();
  const h = { 'idempotency-key': 'k-123' };
  await call('POST', `/carts/${id}/items`, { sku: 'PEGATINAS', quantity: 2 }, h);
  await call('POST', `/carts/${id}/items`, { sku: 'PEGATINAS', quantity: 2 }, h);
  const v = await (await call('GET', `/carts/${id}`)).json();
  assert.equal(v.lines[0].quantity, 2);
});

test('API: errores 400/404/405/422', async () => {
  const { id } = await (await call('POST', '/carts', {})).json();
  assert.equal((await call('POST', `/carts/${id}/items`, '{malo')).status, 400);
  assert.equal((await call('POST', `/carts/${id}/items`, { sku: 'SUDADERA-GRIS-L', quantity: 99 })).status, 422);
  assert.equal((await call('GET', '/nada')).status, 404);
  assert.equal((await call('PUT', `/carts/${id}`)).status, 405);
  assert.equal((await call('GET', '/health')).status, 200);
});
