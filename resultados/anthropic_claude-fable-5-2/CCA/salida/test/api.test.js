import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { CartService } from '../src/cartService.js';
import { sampleCatalog } from '../src/catalog.js';
import { defaultLimits } from '../src/config.js';
import { MemoryCartStore } from '../src/stores/memoryStore.js';

let server;
let base;

before(async () => {
  const store = new MemoryCartStore(defaultLimits);
  const service = new CartService({ store, catalog: sampleCatalog(), limits: defaultLimits });
  server = http.createServer(createApp({ service, store, logger: { error() {} } }));
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => server.close());

async function call(method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

test('flujo completo de un carrito', async () => {
  let res = await call('GET', '/carts/c1');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { id: 'c1', items: [], totalQuantity: 0, subtotal: 0, currency: 'EUR' });

  await call('POST', '/carts/c1/items', { sku: 'CAM-001', quantity: 2 });
  await call('POST', '/carts/c1/items', { sku: 'CAM-001' }); // cantidad por defecto: 1
  res = await call('POST', '/carts/c1/items', { sku: 'GOR-004', quantity: 1 });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.items, [
    { sku: 'CAM-001', name: 'Camiseta básica', unitPrice: 1299, quantity: 3, lineTotal: 3897, available: true },
    { sku: 'GOR-004', name: 'Gorra', unitPrice: 950, quantity: 1, lineTotal: 950, available: true },
  ]);
  assert.equal(res.body.subtotal, 4847);
  assert.equal(res.body.totalQuantity, 4);

  res = await call('PUT', '/carts/c1/items/CAM-001', { quantity: 1 });
  assert.equal(res.body.subtotal, 1299 + 950);

  res = await call('DELETE', '/carts/c1/items/GOR-004');
  assert.deepEqual(res.body.items.map((i) => i.sku), ['CAM-001']);

  res = await call('DELETE', '/carts/c1');
  assert.equal(res.status, 204);
  res = await call('GET', '/carts/c1');
  assert.deepEqual(res.body.items, []);
});

test('Idempotency-Key evita duplicados en reintentos', async () => {
  const headers = { 'idempotency-key': 'abc-123' };
  await call('POST', '/carts/c2/items', { sku: 'ZAP-003', quantity: 1 }, headers);
  const res = await call('POST', '/carts/c2/items', { sku: 'ZAP-003', quantity: 1 }, headers);
  assert.equal(res.status, 200);
  assert.equal(res.body.items[0].quantity, 1);
});

test('errores de validación', async () => {
  const cases = [
    ['POST', '/carts/c3/items', { sku: 'NOPE', quantity: 1 }, 404, 'UNKNOWN_SKU'],
    ['POST', '/carts/c3/items', { sku: 'CAM-001', quantity: 0 }, 400, 'INVALID_REQUEST'],
    ['POST', '/carts/c3/items', { sku: 'CAM-001', quantity: 1.5 }, 400, 'INVALID_REQUEST'],
    ['POST', '/carts/c3/items', { sku: 'CAM-001', quantity: '2' }, 400, 'INVALID_REQUEST'],
    ['POST', '/carts/c3/items', { quantity: 1 }, 400, 'INVALID_REQUEST'],
    ['POST', '/carts/c3/items', '{mal json', 400, 'INVALID_REQUEST'],
    ['POST', '/carts/c3/items', '[]', 400, 'INVALID_REQUEST'],
    ['POST', '/carts/c3/items', { sku: 'CAM-001', pad: 'x'.repeat(11000) }, 413, 'PAYLOAD_TOO_LARGE'],
    ['PUT', '/carts/c3/items/CAM-001', {}, 400, 'INVALID_REQUEST'],
    ['PUT', '/carts/c3/items/CAM-001', { quantity: 100 }, 400, 'INVALID_REQUEST'],
    ['GET', '/carts/id%20con%20espacios', undefined, 400, 'INVALID_REQUEST'],
    ['GET', '/carts/%E0%A4%A', undefined, 400, 'INVALID_REQUEST'],
    ['GET', '/otra-cosa', undefined, 404, 'NOT_FOUND'],
  ];
  for (const [method, path, body, status, code] of cases) {
    const res = await call(method, path, body);
    assert.equal(res.status, status, `${method} ${path} ${JSON.stringify(body)?.slice(0, 60)}`);
    assert.equal(res.body.error.code, code);
  }
  assert.deepEqual((await call('GET', '/carts/c3')).body.items, []);
});

test('límite de unidades por línea', async () => {
  await call('POST', '/carts/c4/items', { sku: 'CAM-001', quantity: 99 });
  const res = await call('POST', '/carts/c4/items', { sku: 'CAM-001', quantity: 1 });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'QUANTITY_LIMIT');
});

test('healthz', async () => {
  assert.deepEqual((await call('GET', '/healthz')).body, { status: 'ok' });
});
