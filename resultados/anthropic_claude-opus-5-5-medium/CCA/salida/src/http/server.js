// API REST sobre node:http (sin dependencias). Sin estado: cualquier réplica
// puede atender cualquier petición.
//
//   POST   /carts                         crear            { ownerId?, currency? }
//   GET    /carts/:id                     ver (con totales y avisos)
//   DELETE /carts/:id                     borrar
//   POST   /carts/:id/items               añadir           { sku, quantity? }
//   PATCH  /carts/:id/items/:sku          fijar cantidad   { quantity }
//   DELETE /carts/:id/items/:sku          quitar producto
//   DELETE /carts/:id/items               vaciar
//   POST   /carts/:id/coupons             aplicar cupón    { code }
//   DELETE /carts/:id/coupons/:code       quitar cupón
//   POST   /carts/:id/merge               fusionar         { sourceCartId }
//   GET    /health
//
// Cabeceras:
//   ETag / If-Match: "<version>"  → concurrencia optimista explícita (409 si no coincide)
//   Idempotency-Key: <uuid>       → reintentos seguros en POST/PATCH/DELETE

import http from 'node:http';
import { DomainError, ValidationError } from '../domain/errors.js';

const MAX_BODY = 16 * 1024;

export function createApp({ service, idempotency }) {
  const routes = [
    ['POST', /^\/carts$/, (_, b) => service.create({ ownerId: b.ownerId ?? null, currency: b.currency ?? 'EUR' }), 201],
    ['GET', /^\/carts\/([^/]+)$/, ([id]) => service.view(id)],
    ['DELETE', /^\/carts\/([^/]+)$/, ([id]) => service.delete(id), 204],
    ['POST', /^\/carts\/([^/]+)\/items$/, ([id], b, o) => service.addItem(id, { sku: b.sku, quantity: b.quantity ?? 1 }, o)],
    ['PATCH', /^\/carts\/([^/]+)\/items\/([^/]+)$/, ([id, sku], b, o) => service.updateItem(id, sku, b.quantity, o)],
    ['DELETE', /^\/carts\/([^/]+)\/items\/([^/]+)$/, ([id, sku], _, o) => service.removeItem(id, sku, o)],
    ['DELETE', /^\/carts\/([^/]+)\/items$/, ([id], _, o) => service.clear(id, o)],
    ['POST', /^\/carts\/([^/]+)\/coupons$/, ([id], b, o) => service.applyCoupon(id, b.code, o)],
    ['DELETE', /^\/carts\/([^/]+)\/coupons\/([^/]+)$/, ([id, code], _, o) => service.removeCoupon(id, code, o)],
    ['POST', /^\/carts\/([^/]+)\/merge$/, ([id], b, o) => service.merge(id, b.sourceCartId, o)],
    ['GET', /^\/health$/, () => ({ status: 'ok', pid: process.pid })],
  ];

  return async function handler(req, res) {
    const started = process.hrtime.bigint();
    try {
      const { pathname } = new URL(req.url, 'http://localhost');
      let pathMatched = false;

      for (const [method, re, action, okStatus = 200] of routes) {
        const m = re.exec(pathname);
        if (!m) continue;
        pathMatched = true;
        if (method !== req.method) continue;

        const params = m.slice(1).map(decodeURIComponent);
        const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readJson(req) : {};
        const opts = { expectedVersion: parseIfMatch(req.headers['if-match']) };

        const exec = () => action(params, body, opts);
        const key = req.headers['idempotency-key'];
        const result =
          key && req.method !== 'GET'
            ? await idempotency.run(`${req.method}:${pathname}:${key}`, exec)
            : await exec();

        if (result && typeof result.version === 'number') res.setHeader('ETag', `"${result.version}"`);
        return send(res, okStatus, okStatus === 204 ? undefined : result);
      }

      if (pathMatched) return send(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido' } });
      return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
    } catch (err) {
      if (err instanceof DomainError) {
        return send(res, err.status, { error: { code: err.code, message: err.message, details: err.details } });
      }
      console.error(err);
      return send(res, 500, { error: { code: 'INTERNAL', message: 'Error interno' } });
    } finally {
      if (process.env.LOG_REQUESTS) {
        const ms = Number(process.hrtime.bigint() - started) / 1e6;
        console.log(`${req.method} ${req.url} ${res.statusCode} ${ms.toFixed(1)}ms`);
      }
    }
  };
}

export function createServer(deps) {
  const server = http.createServer(createApp(deps));
  server.keepAliveTimeout = 65_000; // > timeout típico de balanceadores (60 s)
  server.headersTimeout = 66_000;
  return server;
}

function parseIfMatch(header) {
  if (!header) return undefined;
  const v = Number(String(header).replace(/^W\//, '').replace(/"/g, ''));
  if (!Number.isInteger(v) || v < 0) throw new ValidationError('If-Match debe ser una versión numérica');
  return v;
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new ValidationError('Cuerpo de la petición demasiado grande');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new ValidationError('JSON inválido');
  }
}

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
  });
  res.end(json);
}
