import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const errors = new Counter('cart_errors_total');
const cartLatency = new Trend('cart_operation_latency', true);

export const options = {
  scenarios: {
    // Simula el tráfico de un pico de una promoción: muchas altas simultáneas
    // sobre pocos carritos (el caso que castiga a las implementaciones con
    // "last write wins" y lost updates).
    peak: {
      executor: 'ramping-arrival-rate',
      startRate: 20,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 300,
      stages: [
        { target: 100, duration: '20s' },
        { target: 300, duration: '30s' },
        { target: 0, duration: '10s' },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export function setup() {
  // Un conjunto reducido de carritos compartidos: varias VU escriben en el
  // mismo carrito a propósito, para medir la contención real.
  const carts = [];
  for (let i = 0; i < 20; i += 1) {
    const response = http.post(`${BASE_URL}/v1/carts`, JSON.stringify({}), {
      headers: { 'Content-Type': 'application/json', 'x-session-id': `load-${i}` },
    });
    if (response.status === 201) carts.push(response.json('id'));
  }
  return { carts };
}

export default function (data) {
  const cartId = data.carts[Math.floor(Math.random() * data.carts.length)];
  const sessionId = `load-${Math.floor(Math.random() * 20)}`;

  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': sessionId,
    'Idempotency-Key': `${__VU}-${__ITER}-${Date.now()}`,
  };

  const add = http.post(
    `${BASE_URL}/v1/carts/${cartId}/items`,
    JSON.stringify({ productId: 'prod-notebook', quantity: 1 }),
    { headers },
  );
  cartLatency.add(add.timings.duration);
  const added = check(add, {
    'añadir artículo 2xx': (r) => r.status === 200 || r.status === 409,
  });
  if (!added) errors.add(1);

  const read = http.get(`${BASE_URL}/v1/carts/${cartId}`, { headers });
  cartLatency.add(read.timings.duration);
  const readOk = check(read, {
    'leer carrito 2xx': (r) => r.status === 200,
    'el carrito tiene ETag': (r) => r.headers['Etag'] !== undefined,
  });
  if (!readOk) errors.add(1);
}
