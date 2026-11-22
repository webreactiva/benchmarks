import { CartError, invalid } from './errors.js';

const MAX_BODY_BYTES = 10 * 1024;

const routes = [
  ['GET', /^\/healthz$/, async ({ store }) => {
    await store.ping();
    return [200, { status: 'ok' }];
  }],
  ['GET', /^\/carts\/([^/]+)$/, async ({ service }, [id]) => [200, await service.getCart(id)]],
  ['DELETE', /^\/carts\/([^/]+)$/, async ({ service }, [id]) => {
    await service.clear(id);
    return [204];
  }],
  ['POST', /^\/carts\/([^/]+)\/items$/, async ({ service }, [id], req) => {
    const { sku, quantity = 1 } = await readJson(req);
    const idempotencyKey = req.headers['idempotency-key'];
    return [200, await service.addItem(id, sku, quantity, { idempotencyKey })];
  }],
  ['PUT', /^\/carts\/([^/]+)\/items\/([^/]+)$/, async ({ service }, [id, sku], req) => {
    const { quantity } = await readJson(req);
    return [200, await service.setItem(id, sku, quantity)];
  }],
  ['DELETE', /^\/carts\/([^/]+)\/items\/([^/]+)$/, async ({ service }, [id, sku]) => [
    200,
    await service.removeItem(id, sku),
  ]],
];

/** Devuelve un manejador para `http.createServer`. */
export function createApp({ service, store, logger = console }) {
  return async (req, res) => {
    try {
      const [status, body] = await dispatch({ service, store }, req);
      send(res, status, body);
    } catch (err) {
      if (err instanceof CartError) {
        send(res, err.status, { error: { code: err.code, message: err.message } });
      } else {
        logger.error(err);
        send(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Error interno' } });
      }
    }
  };
}

async function dispatch(deps, req) {
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    throw invalid('URL no válida');
  }
  for (const [method, pattern, handler] of routes) {
    const match = req.method === method && pattern.exec(path);
    if (match) return handler(deps, match.slice(1), req);
  }
  throw new CartError(404, 'NOT_FOUND', 'Ruta no encontrada');
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new CartError(413, 'PAYLOAD_TOO_LARGE', 'Cuerpo demasiado grande');
    chunks.push(chunk);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw invalid('El cuerpo debe ser JSON válido');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalid('El cuerpo debe ser un objeto JSON');
  }
  return body;
}

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}
