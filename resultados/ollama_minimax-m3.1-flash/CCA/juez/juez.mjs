// 40 altas a la vez repartidas entre dos instancias que comparten Redis
import fs from 'node:fs';
const T = fs.readFileSync('token.txt', 'utf8').trim();
const H = { 'content-type': 'application/json', authorization: 'Bearer ' + T };
const c = await (await fetch('http://localhost:3401/v1/carts', { method: 'POST', headers: H, body: '{}' })).json();
const ps = [{ productId: 'prod-tea' }, { productId: 'prod-mug', variantId: 'var-blue' }];
const rs = await Promise.all(Array.from({ length: 40 }, (_, i) => fetch(`http://localhost:${i % 2 ? 3402 : 3401}/v1/carts/${c.id}/items`,
  { method: 'POST', headers: H, body: JSON.stringify({ ...ps[Math.floor(i / 2) % 2], quantity: 1 }) }).then(r => r.status)));
const st = {}; rs.forEach(s => st[s] = (st[s] || 0) + 1);
const v = await (await fetch(`http://localhost:3402/v1/carts/${c.id}`, { headers: H })).json();
console.log('40 altas (dos instancias):', st, '→ unidades guardadas', v.items.reduce((s, l) => s + l.quantity, 0), 'en', v.items.length, 'líneas');
const r = await fetch(`http://localhost:3401/v1/carts/${c.id}/items`, { method: 'POST', headers: H, body: JSON.stringify({ productId: 'prod-tea', quantity: 1, unitPriceCents: 1 }) });
console.log('mandar precio desde el cliente →', r.status, (await r.text()).slice(0, 120));
const sin = await fetch(`http://localhost:3401/v1/carts/${c.id}`); console.log('sin token →', sin.status);
console.log('totales', JSON.stringify(v.totals));
