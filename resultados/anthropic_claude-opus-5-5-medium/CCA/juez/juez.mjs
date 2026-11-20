// Script del juez (no del modelo). Se ejecuta desde una copia de salida/:
//   cd /tmp/cca-opus && node <ruta>/juez/juez.mjs                 # memoria
//   cd /tmp/cca-opus && npm i ioredis && node <ruta>/juez/juez.mjs 6390   # + Redis real y dos instancias HTTP
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
const base = process.cwd();
const imp = (p) => import(pathToFileURL(path.join(base, p)).href);
const { CartService } = await imp('src/application/cartService.js');
const { InMemoryCartRepository } = await imp('src/infrastructure/inMemoryCartRepository.js');
const { RedisCartRepository } = await imp('src/infrastructure/redisCartRepository.js');
const { InMemoryCatalog, InMemoryCouponRepository, InMemoryEventBus } = await imp('src/infrastructure/adapters.js');

const PRODUCTS = [
  ...Array.from({ length: 50 }, (_, i) => ({ sku: 'P' + i, name: 'p', price: 100, stock: null })),
  { sku: 'DEC', name: 'dec', price: 10, stock: null },
  { sku: 'A', name: 'a', price: 1000, stock: null },
];
const mk = (repository) => new CartService({
  repository, catalog: new InMemoryCatalog(PRODUCTS), coupons: new InMemoryCouponRepository({}),
  eventBus: new InMemoryEventBus(), pricing: { rules: [], taxRate: 0, shipping: { flat: 0, freeOver: null } },
});
const tally = (r) => {
  const ok = r.filter((x) => x.status === 'fulfilled').length;
  const codes = [...new Set(r.filter((x) => x.status === 'rejected').map((x) => x.reason.code ?? x.reason.message))];
  return `ok ${ok}, rechazadas ${r.length - ok} ${codes.join(',')}`;
};

async function alta50(name, services) {
  const s0 = services[0];
  let c = await s0.create();
  let r = await Promise.allSettled(Array.from({ length: 50 }, (_, i) => services[i % services.length].addItem(c.id, { sku: 'P' + i })));
  let v = await s0.view(c.id);
  console.log(`[${name}] 50 altas a la vez, 50 productos, ${services.length} servicio(s): ${tally(r)} · líneas ${v.lines.length}, versión ${v.version}`);
  c = await s0.create();
  r = await Promise.allSettled(Array.from({ length: 50 }, (_, i) => services[i % services.length].addItem(c.id, { sku: 'A' })));
  v = await s0.view(c.id);
  console.log(`[${name}] 50 altas a la vez, mismo producto: ${tally(r)} · cantidad ${v.lines[0]?.quantity}, versión ${v.version}`);
}

// ---- memoria
const repo = new InMemoryCartRepository();
const s = mk(repo);
for (let i = 0; i < 3; i++) await alta50('memoria', [s]);

let c = await s.create();
console.log('0,10 × 3 =', (await s.addItem(c.id, { sku: 'DEC', quantity: 3 })).subtotal, 'céntimos');

const usd = await s.create({ currency: 'USD' });
const vu = await s.addItem(usd.id, { sku: 'A' });
console.log('moneda: carrito creado con USD aceptado; catálogo sin moneda; total', vu.total, vu.currency, '(precio del catálogo pensado en EUR)');
const raro = await s.create({ currency: { x: 1 } });
console.log('moneda {x:1} al crear:', JSON.stringify((await s.view(raro.id)).currency), '(sin validar)');

for (const id of ['../fuera', '../../etc/passwd']) {
  try { await s.view(id); console.log(`id ${id}: ACEPTADO`); } catch (e) { console.log(`id ${id} en el servicio: ${e.code} (no existe; no se pueden crear con id elegido)`); }
}
for (const q of [0, -1, 1.5, true, '2', 1e9]) {
  try { await s.addItem(c.id, { sku: 'A', quantity: q }); console.log(`cantidad ${JSON.stringify(q)}: ACEPTADA`); }
  catch (e) { console.log(`cantidad ${JSON.stringify(q)}: rechazada ${e.code}`); }
}
for (const sku of ['../x', '..', 'A B']) {
  try { await s.addItem(c.id, { sku }); console.log(`sku ${sku}: ACEPTADO`); } catch (e) { console.log(`sku ${JSON.stringify(sku)}: rechazado ${e.code}`); }
}

c = await s.create();
const dev = await s.addItem(c.id, { sku: 'A' });
try { dev.lines[0].quantity = 500; dev.lines[0].unitPrice = 1; dev.lines.push({ sku: 'X', unitPrice: 1, quantity: 1 }); } catch (e) { console.log('mutación lanzó', e.message); }
const raw = await repo.get(c.id);
raw.items[0].quantity = 500; raw.items[0].unitPrice = 1;
const v2 = await s.view(c.id);
console.log('objeto devuelto (vista y repo.get) mutados → en el almacén cantidad', v2.lines[0].quantity, 'precio', v2.lines[0].unitPrice, 'líneas', v2.lines.length);

// ---- HTTP en memoria
const { createServer } = await imp('src/http/server.js');
const { buildContainer } = await imp('src/container.js');
const deps = await buildContainer({});
const srv = createServer(deps).listen(0);
await new Promise((r) => srv.once('listening', r));
const url = `http://127.0.0.1:${srv.address().port}`;
const req = (u, m = 'GET', b) => fetch(u, { method: m, body: b && JSON.stringify(b) }).then(async (r) => ({ st: r.status, j: r.status === 204 ? null : await r.json() }));
let h = await req(url + '/carts', 'POST', {});
let hp = await req(`${url}/carts/${h.j.id}/items`, 'POST', { sku: 'TAZA-LOGO', quantity: 1, unitPrice: 1, price: 1 });
console.log('HTTP precio del cliente (1 ¢): subtotal', hp.j.subtotal, '(catálogo 800)');
let r = await Promise.all(Array.from({ length: 50 }, () => req(`${url}/carts/${h.j.id}/items`, 'POST', { sku: 'PEGATINAS' })));
const cnt = (arr) => Object.entries(arr.reduce((a, x) => ((a[x.st] = (a[x.st] ?? 0) + 1), a), {})).map(([k, n]) => `${k} × ${n}`).join(', ');
let hv = await req(`${url}/carts/${h.j.id}`);
console.log('HTTP memoria, 50 POST a la vez del mismo producto:', cnt(r), '→ cantidad', hv.j.lines.find((l) => l.sku === 'PEGATINAS')?.quantity);
for (const p of ['/carts/..%2Ffuera', '/carts/../fuera', '/carts/%2E%2E%2Ffuera/items']) {
  const x = await fetch(url + p, { method: p.endsWith('items') ? 'POST' : 'GET', body: p.endsWith('items') ? '{"sku":"TAZA-LOGO"}' : undefined });
  console.log(`HTTP ${p}: ${x.status}`);
}
const ph = await req(`${url}/carts/${h.j.id}/items/TAZA-LOGO`, 'PATCH', { quantity: 3 });
const dl = await req(`${url}/carts/${h.j.id}/items/TAZA-LOGO`, 'DELETE');
const cl = await req(`${url}/carts/${h.j.id}/items`, 'DELETE');
console.log('HTTP cambiar cantidad', ph.st, ph.j.lines.find((l) => l.sku === 'TAZA-LOGO')?.quantity, '· quitar', dl.st, dl.j.lines.length, 'líneas · vaciar', cl.st, cl.j.lines.length, 'líneas, total', cl.j.total);
srv.close();

// ---- Redis real
const port = process.argv[2];
if (port) {
  const { default: Redis } = await import(pathToFileURL(path.join(base, 'node_modules/ioredis/built/index.js')).href);
  const clients = [new Redis({ port: Number(port) }), new Redis({ port: Number(port) })];
  await clients[0].flushdb();
  const svcs = clients.map((cl) => mk(new RedisCartRepository({ client: cl })));
  for (let i = 0; i < 3; i++) await alta50('redis, 2 servicios', svcs);
  const k = (await clients[0].keys('cart:*'))[0];
  console.log('redis clave', k, 'TTL', await clients[0].ttl(k), 's');
  const mut = await svcs[0].create();
  const d = await svcs[0].addItem(mut.id, { sku: 'A' }); d.lines[0].quantity = 500;
  console.log('redis objeto devuelto mutado → guardado', (await svcs[1].view(mut.id)).lines[0].quantity);
  clients.forEach((cl) => cl.disconnect());

  // dos instancias HTTP reales (npm start con REDIS_URL)
  const ports = [3311, 3312];
  const procs = ports.map((p) => spawn('node', ['src/index.js'], { cwd: base, env: { ...process.env, PORT: String(p), REDIS_URL: `redis://127.0.0.1:${port}` }, stdio: ['ignore', 'pipe', 'inherit'] }));
  await Promise.all(procs.map((pr) => new Promise((res) => pr.stdout.once('data', (b) => { console.log('  ', b.toString().trim()); res(); }))));
  const U = ports.map((p) => `http://127.0.0.1:${p}`);
  for (const [sku, label] of [['PEGATINAS', 'mismo producto'], [null, '4 productos']]) {
    const id = (await req(U[0] + '/carts', 'POST', {})).j.id;
    const skus = ['PEGATINAS', 'TAZA-LOGO', 'CAMISETA-AZUL-M', 'SUDADERA-GRIS-L'];
    // límite de 99 unidades/línea y stock: con 4 productos, 50 altas reparten 13/13/12/12 (sudadera stock 15)
    r = await Promise.all(Array.from({ length: 50 }, (_, i) => req(`${U[i % 2]}/carts/${id}/items`, 'POST', { sku: sku ?? skus[i % 4] })));
    hv = await req(`${U[1]}/carts/${id}`);
    const units = hv.j.lines.reduce((a, l) => a + l.quantity, 0);
    console.log(`HTTP 2 instancias + Redis, 50 POST a la vez (${label}): ${cnt(r)} → ${units} unidades en ${hv.j.lines.length} líneas, versión ${hv.j.version}`);
  }
  const id = (await req(U[0] + '/carts', 'POST', {})).j.id;
  await req(`${U[0]}/carts/${id}/items`, 'POST', { sku: 'TAZA-LOGO' });
  const seen = await req(`${U[1]}/carts/${id}`);
  await req(`${U[1]}/carts/${id}`, 'DELETE');
  const gone = await req(`${U[0]}/carts/${id}`);
  console.log('alta en A la ve B:', seen.j.lines.length, 'línea · DELETE en B, GET en A:', gone.st);
  procs.forEach((p) => p.kill('SIGTERM'));
}
