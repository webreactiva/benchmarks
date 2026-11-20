#!/usr/bin/env node
/**
 * End to end smoke test of the cart API.
 *
 *   npm run build && npm run smoke
 *   REDIS_URL=redis://localhost:6379 npm run smoke
 *
 * It boots the real server, walks through the whole shopping flow and prints
 * every step. Exits with a non zero code if anything goes wrong.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.env.SMOKE_PORT ?? 3111);
const BASE = `http://127.0.0.1:${PORT}`;
const CUSTOMER = { 'x-customer-id': 'smoke-customer' };

const child = spawn(process.execPath, ['packages/server/dist/main.js'], {
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: '127.0.0.1',
    LOG_LEVEL: 'warn',
    NODE_ENV: 'production',
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});

let failures = 0;

const step = (title, detail) => {
  console.log(`\n[1m▶ ${title}[0m`);
  console.log(`  ${detail}`);
};

const check = (condition, message) => {
  if (condition) {
    console.log(`  [32m✓[0m ${message}`);
  } else {
    failures += 1;
    console.log(`  [31m✗[0m ${message}`);
  }
};

const api = async (method, path, { body, headers = {} } = {}) => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { status: response.status, payload, headers: response.headers };
};

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/health/ready`);
      if (response.ok) return true;
    } catch {
      /* not ready yet */
    }
    await sleep(250);
  }
  return false;
};

const main = async () => {
  const ready = await waitForServer();
  if (!ready) {
    console.error('the server did not become ready');
    failures += 1;
    return;
  }

  step('Health', 'the readiness probe reports the state of the dependencies');
  const health = await api('GET', '/health/ready');
  check(health.status === 200, `GET /health/ready -> ${health.status}`);
  console.log(`  checks: ${JSON.stringify(health.payload.checks)}`);

  step('Catálogo', 'the storefront reads the products from the catalogue');
  const products = await api('GET', '/api/v1/products');
  check(products.status === 200, `GET /api/v1/products -> ${products.status}`);
  check(
    products.payload.products.length > 0,
    `${products.payload.products.length} products available`,
  );

  step('Creación del carrito', 'an empty cart starts at version 0');
  const created = await api('POST', '/api/v1/carts', { headers: CUSTOMER });
  check(created.status === 201, `POST /api/v1/carts -> ${created.status}`);
  const cartId = created.payload.cart.id;
  check(created.payload.cart.version === 0, 'the cart starts at version 0');
  console.log(`  cart id: ${cartId}`);

  step('Añadir productos', 'adding two products in a single atomic request');
  const added = await api('POST', `/api/v1/carts/${cartId}/items`, {
    headers: CUSTOMER,
    body: {
      items: [
        { productId: 'sku-espresso', quantity: 2 },
        { productId: 'sku-taza', quantity: 1 },
      ],
    },
  });
  check(added.status === 200, `POST /items -> ${added.status}`);
  check(added.payload.cart.lines.length === 2, 'the cart has 2 lines');
  console.log(
    `  subtotal: ${added.payload.totals.subtotal.amount} · shipping: ${added.payload.totals.shipping.amount} · tax: ${added.payload.totals.tax.amount} · total: ${added.payload.totals.total.amount}`,
  );

  step('Idempotencia', 'the same Idempotency-Key never adds the product twice');
  const idempotentHeaders = { ...CUSTOMER, 'idempotency-key': 'smoke-1' };
  const first = await api('POST', `/api/v1/carts/${cartId}/items`, {
    headers: idempotentHeaders,
    body: { productId: 'sku-bolas', quantity: 2 },
  });
  const second = await api('POST', `/api/v1/carts/${cartId}/items`, {
    headers: idempotentHeaders,
    body: { productId: 'sku-bolas', quantity: 2 },
  });
  check(first.headers.get('idempotent-replay') === null, 'the first call is executed');
  check(second.headers.get('idempotent-replay') === 'true', 'the second call is replayed');
  const afterReplay = await api('GET', `/api/v1/carts/${cartId}`, { headers: CUSTOMER });
  const bolas = afterReplay.payload.cart.lines.find((line) => line.productId === 'sku-bolas');
  check(bolas?.quantity === 2, `the line has 2 units (got ${bolas?.quantity})`);

  step('Cupón', 'the percentage coupon is applied on the subtotal');
  const coupon = await api('POST', `/api/v1/carts/${cartId}/coupons`, {
    headers: CUSTOMER,
    body: { code: 'BIENVENIDA10' },
  });
  check(coupon.status === 200, `POST /coupons -> ${coupon.status}`);
  console.log(`  discount: ${coupon.payload.totals.couponDiscount.amount}`);

  step('Concurrencia', 'two concurrent writes are serialised without losing lines');
  const concurrent = await Promise.all([
    api('PATCH', `/api/v1/carts/${cartId}/items/sku-taza`, {
      headers: CUSTOMER,
      body: { quantity: 2 },
    }),
    api('PATCH', `/api/v1/carts/${cartId}/items/sku-espresso`, {
      headers: CUSTOMER,
      body: { quantity: 3 },
    }),
  ]);
  check(
    concurrent.every((response) => response.status === 200),
    `both writes succeed (${concurrent.map((response) => response.status).join(', ')})`,
  );

  step('Checkout', 'the stock is reserved atomically and the cart is closed');
  const checkout = await api('POST', `/api/v1/carts/${cartId}/checkout`, { headers: CUSTOMER });
  check(checkout.status === 200, `POST /checkout -> ${checkout.status}`);
  check(checkout.payload.cart.status === 'converted', 'the cart is closed');
  check(Boolean(checkout.payload.reservationId), `reservation: ${checkout.payload.reservationId}`);

  step('Errores', 'the API answers with a problem document');
  const missing = await api('GET', '/api/v1/carts/does-not-exist', { headers: CUSTOMER });
  check(
    missing.status === 404,
    `GET unknown cart -> ${missing.status} (${missing.payload.error.code})`,
  );
  const forbidden = await api('GET', `/api/v1/carts/${cartId}`, {
    headers: { 'x-customer-id': 'another-customer' },
  });
  check(
    forbidden.status === 403,
    `GET foreign cart -> ${forbidden.status} (${forbidden.payload.error.code})`,
  );
};

try {
  await main();
} catch (error) {
  console.error('\nthe smoke test crashed', error);
  failures += 1;
} finally {
  child.kill('SIGTERM');
}

console.log('');
if (failures === 0) {
  console.log('[32m✔ the smoke test passed[0m');
} else {
  console.log(`[31m✗ ${failures} check(s) failed[0m`);
}
process.exit(failures === 0 ? 0 : 1);
