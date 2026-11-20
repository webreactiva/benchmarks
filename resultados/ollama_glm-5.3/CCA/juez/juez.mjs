// node juez/juez.mjs <copia-compilada>   (npm ci && npm run build en la copia)
// Las pruebas de siempre del juez de CCA contra el servidor (dist/index.js):
//   50 altas concurrentes del mismo producto en el mismo carrito, en una instancia y repartidas entre dos que
//   comparten el mismo SQLite (DB_FILE); se compara lo aceptado con lo guardado.
//   Precio mandado por el cliente, cantidades raras, ids con «../», cuerpo vacío.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const dir = path.resolve(process.argv[2]);
const db = path.join(dir, 'data', 'juez.db');
fs.rmSync(path.join(dir, 'data'), { recursive: true, force: true });
fs.mkdirSync(path.join(dir, 'data'));
const procs = [];
const espera = ms => new Promise(r => setTimeout(r, ms));
for (const port of [3401, 3402]) {
  procs.push(spawn('node', ['dist/index.js'], { cwd: dir, env: { ...process.env, PORT: String(port), DB_FILE: db }, stdio: 'ignore' }));
  await espera(2500);
}
const api = async (port, metodo, ruta, body) => {
  const r = await fetch(`http://localhost:${port}${ruta}`, { method: metodo, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const out = {};
const prods = (await api(3401, 'GET', '/api/products')).j;
const lista = prods.products ?? prods.items ?? prods;
const prod = [...lista].sort((a, b) => b.stock - a.stock)[0];
out.producto = `${prod.id} (stock ${prod.stock})`;
const cantidad = j => (j?.items ?? j?.cart?.items ?? j?.lines ?? []).find(i => (i.productId ?? i.id) === prod.id)?.quantity ?? 0;
for (const [nombre, puertos] of [['una_instancia', [3401]], ['dos_instancias', [3401, 3402]]]) {
  const c = await api(3401, 'POST', '/api/carts', {});
  const id = c.j.id ?? c.j.cart?.id ?? c.j.cartId;
  const rs = await Promise.all(Array.from({ length: 50 }, (_, i) => api(puertos[i % puertos.length], 'POST', `/api/carts/${id}/items`, { productId: prod.id, quantity: 1 })));
  const st = {}; rs.forEach(r => { st[r.s] = (st[r.s] || 0) + 1; });
  const v = await api(puertos.at(-1), 'GET', `/api/carts/${id}`);
  out[nombre] = { respuestas: st, aceptadas: rs.filter(r => r.s < 300).length, guardadas: cantidad(v.j),
    errores: [...new Set(rs.filter(r => r.s >= 400).map(r => JSON.stringify(r.j).slice(0, 140)))] };
}
const c = await api(3401, 'POST', '/api/carts', {});
const id = c.j.id ?? c.j.cart?.id ?? c.j.cartId;
const otro = lista.find(x => x.id !== prod.id);
const prueba = async (k, m, ruta, body) => { const r = await api(3401, m, ruta, body); out[k] = [r.s, JSON.stringify(r.j).slice(0, 200)]; };
await prueba('precio_del_cliente', 'POST', `/api/carts/${id}/items`, { productId: otro.id, quantity: 1, priceCents: 1, price: 0.01 });
await prueba('carrito_tras_precio', 'GET', `/api/carts/${id}`);
for (const [k, q] of [['cantidad_0', 0], ['cantidad_negativa', -3], ['cantidad_decimal', 1.5], ['cantidad_enorme', 1e9], ['cantidad_texto', '2']])
  await prueba(k, 'POST', `/api/carts/${id}/items`, { productId: otro.id, quantity: q });
await prueba('producto_con_puntos', 'POST', `/api/carts/${id}/items`, { productId: '../../etc/passwd', quantity: 1 });
await prueba('cartId_con_puntos', 'GET', '/api/carts/..%2F..%2Fetc%2Fpasswd');
await prueba('cuerpo_vacio', 'POST', `/api/carts/${id}/items`, undefined);
console.log(JSON.stringify(out, null, 1));
for (const p of procs) p.kill();
