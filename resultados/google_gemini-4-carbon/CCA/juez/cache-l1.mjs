// node juez/cache-l1.mjs <copia-de-salida>
// Dos instancias con el mismo SQLite: ¿la caché L1 de una da datos viejos cuando escribe la otra?
// A escribe, B lee (y lo guarda en su L1), A vuelve a escribir, B lee otra vez. Luego B escribe sobre su copia.
import { spawn } from 'node:child_process';
import path from 'node:path';
const dir = path.resolve(process.argv[2]);
const db = path.join(dir, 'data', 'cache-l1.sqlite');
const procs = [];
const espera = ms => new Promise(r => setTimeout(r, ms));
for (const port of [3321, 3322]) {
  procs.push(spawn('node', ['--no-warnings', 'src/server.ts'], { cwd: dir, env: { ...process.env, PORT: String(port), CART_DB_PATH: db }, stdio: 'ignore' }));
  await espera(1500);
}
const J = { 'content-type': 'application/json' };
const api = async (port, metodo, ruta, body) => (await fetch(`http://localhost:${port}${ruta}`, { method: metodo, headers: J, body: body && JSON.stringify(body) })).json();
const A = 3321, B = 3322, sku = 'USB-HUB-7IN1';
const id = (await api(A, 'POST', '/api/v1/carts', { sessionId: 'l1' })).cart.id;
const lee = async p => { const c = (await api(p, 'GET', `/api/v1/carts/${id}`)).cart; return `v${c.version} cantidad ${c.items[0]?.quantity ?? 0}`; };
const mete = p => api(p, 'POST', `/api/v1/carts/${id}/items`, { sku, quantity: 1 });
const log = [];
await mete(A); log.push(['A añade 1; B lee', await lee(B)]);
await mete(A); log.push(['A añade otra; B lee', await lee(B)], ['A lee', await lee(A)]);
await mete(B); log.push(['B añade 1; B lee', await lee(B)], ['A lee', await lee(A)]);
console.log(JSON.stringify(log, null, 1));
for (const p of procs) p.kill();
