// 50 altas concurrentes repartidas entre dos instancias que comparten Redis
const H = { 'content-type': 'application/json', 'x-customer-id': 'juez' };
const prods = (await (await fetch('http://localhost:3201/api/v1/products')).json()).products;
const c = await (await fetch('http://localhost:3201/api/v1/carts', { method: 'POST', headers: H, body: '{}' })).json();
const id = c.id ?? c.cart?.id ?? c.cartId; console.log('carrito', id, '· productos en catálogo', prods.length);
const p = prods[0];
const rs = await Promise.all(Array.from({ length: 50 }, (_, i) => fetch(`http://localhost:${i % 2 ? 3202 : 3201}/api/v1/carts/${id}/items`,
  { method: 'POST', headers: H, body: JSON.stringify({ productId: p.id, quantity: 1 }) }).then(r => r.status)));
const st = {}; rs.forEach(s => st[s] = (st[s] || 0) + 1); console.log('respuestas', st);
const v = await (await fetch(`http://localhost:3202/api/v1/carts/${id}`, { headers: H })).json();
const lines = v.lines ?? v.items ?? v.cart?.lines; console.log('cantidad guardada', lines?.[0]?.quantity, 'de', st[200] ?? st[201]);
// precio del cliente
const r2 = await fetch(`http://localhost:3201/api/v1/carts/${id}/items`, { method: 'POST', headers: H, body: JSON.stringify({ productId: prods[1].id, quantity: 1, price: 1 }) });
console.log('mandar precio desde el cliente →', r2.status);
console.log('totales', JSON.stringify(v.totals ?? v.summary ?? {}).slice(0, 200));
