const H = { 'content-type': 'application/json', 'x-customer-id': 'juez2' };
const prods = (await (await fetch('http://localhost:3201/api/v1/products')).json()).products;
const nuevo = async () => { const c = await (await fetch('http://localhost:3201/api/v1/carts', { method: 'POST', headers: H, body: '{}' })).json(); return c.id ?? c.cart?.id ?? c.cartId; }; const id = await nuevo();
const r = await fetch(`http://localhost:3201/api/v1/carts/${id}/items`, { method: 'POST', headers: H, body: JSON.stringify({ productId: prods[0].id, quantity: 11 }) });
console.log('cantidad 11 →', r.status, (await r.text()).slice(0, 160));
const id2 = await nuevo();
const rs = await Promise.all(Array.from({ length: 40 }, (_, i) => fetch(`http://localhost:${i % 2 ? 3202 : 3201}/api/v1/carts/${id2}/items`,
  { method: 'POST', headers: H, body: JSON.stringify({ productId: prods[i % 8].id, quantity: 1 }) }).then(r => r.status)));
const st = {}; rs.forEach(s => st[s] = (st[s] || 0) + 1);
const v = await (await fetch(`http://localhost:3202/api/v1/carts/${id2}`, { headers: H })).json();
console.log('40 altas (8 productos × 5, dos instancias):', st, '→ unidades guardadas', (v.lines ?? v.cart.lines).reduce((s, l) => s + l.quantity, 0), 'en', (v.lines ?? v.cart.lines).length, 'líneas');
