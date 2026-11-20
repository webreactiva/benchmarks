const test = require('node:test');
const assert = require('node:assert/strict');
const { server } = require('../src/http/server');

test('http cart flow', async (t) => {
  const srv = server.listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  t.after(() => srv.close());
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
  const created = await post('/carts', { userId: 'u1' });
  assert.ok(created.id);
  await post(`/carts/${created.id}/items`, { productId: 'p1', name: 'Widget', price: 3, quantity: 2 });
  const r = await fetch(base + `/carts/${created.id}`);
  const cart = await r.json();
  assert.equal(cart.total, 6);
});
