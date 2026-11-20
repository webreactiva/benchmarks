const { CartManager } = require('./src');
(async () => {
  const m = new CartManager(); const c = await m.createCart({ currency: 'EUR' });
  await Promise.all(Array.from({ length: 50 }, (_, i) => m.addItem(c.id, { productId: 'p' + (i % 5), name: 'x', price: 1, quantity: 1 })));
  const v = await m.getCart(c.id); console.log('50 altas a la vez: unidades', [...v.items.values()].reduce((s, i) => s + i.quantity, 0));
  const c2 = await m.createCart({ currency: 'EUR' }); await m.addItem(c2.id, { productId: 'a', name: 'a', price: 0.1, quantity: 3 });
  const v2 = await m.getCart(c2.id); console.log('0,10 × 3 =', [...v2.items.values()][0].total(), '· totales', JSON.stringify(v2.totals ? v2.totals() : v2.summary?.() ?? ''));
  await m.addItem(c2.id, { productId: 'b', name: 'b', price: 0.01, quantity: 1 }); console.log('precio 0,01 € mandado por el cliente: aceptado');
})();
