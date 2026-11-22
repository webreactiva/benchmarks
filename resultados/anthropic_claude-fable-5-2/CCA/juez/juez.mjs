// node juez/juez.mjs <copia-instalada> <puerto-de-redis>
// Las pruebas de siempre del juez de CCA contra el servidor (src/server.js):
//   50 altas concurrentes del mismo SKU en el mismo carrito: en una instancia con almacén en memoria, en una con Redis
//   y repartidas entre dos instancias que comparten el mismo Redis (REDIS_URL); se compara lo aceptado con lo guardado.
//   Las mismas 50 altas repartidas entre dos instancias SIN Redis (cada una con su memoria), para ver qué pasa.
//   Precio mandado por el cliente, cantidades raras, SKU y cartId con «../», cuerpo vacío, 0,10 × 3 (no aplica: céntimos).
import { spawn } from 'node:child_process';
import path from 'node:path';
const dir = path.resolve(process.argv[2]);
const redis = `redis://localhost:${process.argv[3] ?? 6390}`;
const espera = ms => new Promise(r => setTimeout(r, ms));
const procs = [];
async function arranca(port, env) {
  procs.push(spawn('node', ['src/server.js'], { cwd: dir, env: { ...process.env, PORT: String(port), ...env }, stdio: 'ignore' }));
  await espera(1500);
}
await arranca(3501, {});                      // memoria
await arranca(3502, {});                      // memoria, otra instancia
await arranca(3511, { REDIS_URL: redis });    // Redis
await arranca(3512, { REDIS_URL: redis });    // Redis, otra instancia
const api = async (port, metodo, ruta, body, raw) => {
  const r = await fetch(`http://localhost:${port}${ruta}`, { method: metodo, headers: { 'content-type': 'application/json' },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const out = {};
const cantidad = j => (j?.items ?? []).find(i => i.sku === 'CAM-001')?.quantity ?? 0;
for (const [nombre, puertos] of [['una_instancia_memoria', [3501]], ['dos_instancias_sin_redis', [3501, 3502]],
  ['una_instancia_redis', [3511]], ['dos_instancias_redis', [3511, 3512]]]) {
  const id = 'juez' + nombre.replace(/_/g, '');
  const rs = await Promise.all(Array.from({ length: 50 }, (_, i) => api(puertos[i % puertos.length], 'POST', `/carts/${id}/items`, { sku: 'CAM-001', quantity: 1 })));
  const st = {}; rs.forEach(r => { st[r.s] = (st[r.s] || 0) + 1; });
  const vistas = await Promise.all(puertos.map(p => api(p, 'GET', `/carts/${id}`)));
  out[nombre] = { respuestas: st, aceptadas: rs.filter(r => r.s < 300).length, guardadas: vistas.map(v => cantidad(v.j)) };
}
const id = 'juezvarios';
const prueba = async (k, m, ruta, body, raw) => { const r = await api(3511, m, ruta, body, raw); out[k] = [r.s, JSON.stringify(r.j).slice(0, 200)]; };
await prueba('precio_del_cliente', 'POST', `/carts/${id}/items`, { sku: 'GOR-004', quantity: 1, price: 1, unitPrice: 1 });
await prueba('carrito_tras_precio', 'GET', `/carts/${id}`);
for (const [k, q] of [['cantidad_0', 0], ['cantidad_negativa', -3], ['cantidad_decimal', 1.5], ['cantidad_enorme', 1e9], ['cantidad_texto', '2']])
  await prueba(k, 'POST', `/carts/${id}/items`, { sku: 'GOR-004', quantity: q });
await prueba('sku_inexistente', 'POST', `/carts/${id}/items`, { sku: 'NO-EXISTE', quantity: 1 });
await prueba('sku_con_puntos', 'POST', `/carts/${id}/items`, { sku: '../../etc/passwd', quantity: 1 });
await prueba('sku_con_puntos_en_ruta', 'PUT', `/carts/${id}/items/..%2F..%2Fetc`, { quantity: 1 });
await prueba('cartId_con_puntos', 'GET', '/carts/..%2F..%2Fetc%2Fpasswd');
await prueba('cuerpo_vacio', 'POST', `/carts/${id}/items`, undefined, '');
await prueba('cuerpo_no_json', 'POST', `/carts/${id}/items`, undefined, 'hola');
// cambiar cantidad, quitar y vaciar
await prueba('fijar_3', 'PUT', `/carts/${id}/items/GOR-004`, { quantity: 3 });
await prueba('quitar', 'DELETE', `/carts/${id}/items/GOR-004`);
await prueba('vaciar', 'DELETE', `/carts/${id}`);
// «mutar el objeto devuelto»: cada respuesta es JSON nuevo; se comprueba que releer da lo mismo tras modificar la copia
const a = await api(3511, 'POST', `/carts/${id}/items`, { sku: 'CAM-001', quantity: 2 });
a.j.items[0].quantity = 999;
out.mutar = `tras mutar la respuesta y releer: ${cantidad((await api(3511, 'GET', `/carts/${id}`)).j)}`;
console.log(JSON.stringify(out, null, 1));
for (const p of procs) p.kill();
