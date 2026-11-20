// node juez/juez.mjs <copia-de-salida>
// Las pruebas de siempre del juez de CCA, en una copia:
//   1. 50 altas concurrentes del mismo SKU en el mismo carrito, en una instancia y repartidas entre dos instancias
//      que comparten el mismo fichero SQLite (CART_DB_PATH)
//   2. precio mandado por el cliente, cantidades raras, sku y cartId con «../»
//   3. dominio: 0,10 × 3, sumar monedas distintas, mutar el objeto devuelto
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const dir = path.resolve(process.argv[2]);
const db = path.join(dir, 'data', 'juez.sqlite');
fs.rmSync(path.dirname(db), { recursive: true, force: true });
const procs = [];
const arranca = port => new Promise((ok, ko) => {
  const p = spawn('node', ['--no-warnings', 'src/server.ts'], { cwd: dir, env: { ...process.env, PORT: String(port), CART_DB_PATH: db } });
  procs.push(p);
  let s = '';
  p.stdout.on('data', d => { s += d; if (/listen|escuch|http:\/\//i.test(s)) ok(); });
  p.stderr.on('data', d => { s += d; });
  p.on('exit', c => ko(new Error(`sale ${c}: ${s}`)));
  setTimeout(ok, 3000);
});
await arranca(3301); await arranca(3302);
const J = { 'content-type': 'application/json' };
const api = async (port, metodo, ruta, body, h = {}) => {
  const r = await fetch(`http://localhost:${port}${ruta}`, { method: metodo, headers: { ...J, ...h }, body: body && JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const out = {};
const prods = (await api(3301, 'GET', '/api/v1/products')).j;
const lista = prods.products ?? prods.items ?? prods;
// el SKU con más stock (el primero solo tiene 25 y taparía la prueba de las 50 altas)
const sku = [...lista].sort((a, b) => (b.availableStock ?? b.stock ?? 0) - (a.availableStock ?? a.stock ?? 0))[0].sku;
out.sku_de_la_prueba = sku;
const cantidad = (c, s) => {
  const items = c.items ?? c.cart?.items ?? c.lines ?? [];
  return (Array.isArray(items) ? items : Object.values(items)).find(i => i.sku === s)?.quantity;
};
for (const [nombre, puertos] of [['una_instancia', [3301]], ['dos_instancias', [3301, 3302]]]) {
  const c = await api(3301, 'POST', '/api/v1/carts', { sessionId: 'juez-' + nombre });
  const id = c.j.id ?? c.j.cart?.id ?? c.j.cartId;
  const rs = await Promise.all(Array.from({ length: 50 }, (_, i) =>
    api(puertos[i % puertos.length], 'POST', `/api/v1/carts/${id}/items`, { sku, quantity: 1 })));
  const st = {}; rs.forEach(r => { st[r.s] = (st[r.s] || 0) + 1; });
  const v = await api(puertos.at(-1), 'GET', `/api/v1/carts/${id}`);
  out[nombre] = { respuestas: st, guardadas: cantidad(v.j.cart ?? v.j, sku), errores: [...new Set(rs.filter(r => r.s >= 400).map(r => JSON.stringify(r.j).slice(0, 160)))] };
}
const c = await api(3301, 'POST', '/api/v1/carts', { sessionId: 'juez-validacion' });
const id = c.j.id ?? c.j.cart?.id ?? c.j.cartId;
const prueba = async (nombre, metodo, ruta, body) => { const r = await api(3301, metodo, ruta, body); out[nombre] = [r.s, JSON.stringify(r.j).slice(0, 220)]; return r; };
await prueba('precio_del_cliente', 'POST', `/api/v1/carts/${id}/items`, { sku: lista[1].sku, quantity: 1, unitPrice: 1, price: 1 });
const tras = await api(3301, 'GET', `/api/v1/carts/${id}`);
out.precio_guardado = JSON.stringify((tras.j.cart ?? tras.j).items ?? '').slice(0, 300);
await prueba('cantidad_0', 'POST', `/api/v1/carts/${id}/items`, { sku, quantity: 0 });
await prueba('cantidad_negativa', 'POST', `/api/v1/carts/${id}/items`, { sku, quantity: -3 });
await prueba('cantidad_decimal', 'POST', `/api/v1/carts/${id}/items`, { sku, quantity: 1.5 });
await prueba('cantidad_enorme', 'POST', `/api/v1/carts/${id}/items`, { sku, quantity: 1e9 });
await prueba('sku_inexistente', 'POST', `/api/v1/carts/${id}/items`, { sku: 'NO-EXISTE', quantity: 1 });
await prueba('sku_con_puntos', 'POST', `/api/v1/carts/${id}/items`, { sku: '../../etc/passwd', quantity: 1 });
await prueba('cartId_con_puntos', 'GET', `/api/v1/carts/..%2F..%2Fetc%2Fpasswd`);
await prueba('cuerpo_roto', 'POST', `/api/v1/carts/${id}/items`, undefined);
// Dominio
const { Money } = await import(path.join(dir, 'src/domain/money.ts'));
const diez = Money.ofMinor(10, 'EUR');
out.cero_diez_por_tres = diez.multiply(3).toJSON();
try { Money.ofMinor(100, 'EUR').add(Money.ofMinor(100, 'USD')); out.monedas_mezcladas = 'las suma'; } catch (e) { out.monedas_mezcladas = 'error: ' + e.message; }
const v = await api(3301, 'GET', `/api/v1/carts/${id}`);
out.carrito_final = JSON.stringify(v.j).slice(0, 500);
// Objeto devuelto: se muta la vista que da el servicio y se vuelve a leer
const { createShoppingCartApp } = await import(path.join(dir, 'src/server.ts'));
const app = createShoppingCartApp({ sqlitePath: path.join(dir, 'data', 'juez-mut.sqlite') });
const vc = await app.cartService.createOrGetActiveCart({ sessionId: 'juez-mut' });
const cid = vc.id ?? vc.cart?.id;
const v1 = await app.cartService.addItem({ cartId: cid, sku, quantity: 2 });
try { v1.items[0].quantity = 999; v1.items.push({ sku: 'X' }); } catch (e) { out.mutar_vista = 'no deja: ' + e.message; }
const v2 = await app.cartService.getCart(cid);
out.mutar_vista ??= `deja mutar la copia; al releer: ${v2.items.length} línea(s), cantidad ${v2.items[0].quantity}`;
out.money_congelado = Object.isFrozen(Money.ofMinor(1, 'EUR'));
await app.close();
console.log(JSON.stringify(out, null, 1));
for (const p of procs) p.kill();
