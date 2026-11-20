import { CartService, FileStorage, InMemoryStorage } from './src/index';
(async () => {
  // 1. Concurrencia: 50 addItem a la vez sobre el mismo carrito, con FileStorage
  const s = new CartService({ storage: new FileStorage('/tmp/cca-prueba/juez-data') });
  await s.createCart('c1');
  await Promise.all(Array.from({ length: 50 }, (_, i) => s.addItem('c1', { productId: 'p' + i, name: 'x', price: 1, currency: 'EUR', quantity: 1 })));
  console.log('concurrencia FileStorage: líneas esperadas 50, guardadas', (await s.getCart('c1'))!.items.length);
  const m = new CartService({ storage: new InMemoryStorage() });
  await Promise.all(Array.from({ length: 50 }, () => m.addItem('c2', { productId: 'p', name: 'x', price: 1, currency: 'EUR', quantity: 1 })));
  console.log('concurrencia memoria: cantidad esperada 50, guardada', (await m.getCart('c2'))!.items[0]?.quantity);
  // 2. Monedas mezcladas
  await m.addItem('c3', { productId: 'a', name: 'a', price: 10, currency: 'EUR', quantity: 1 });
  await m.addItem('c3', { productId: 'b', name: 'b', price: 10, currency: 'USD', quantity: 1 });
  console.log('monedas mezcladas:', m.getSummary((await m.getCart('c3'))!));
  // 3. Decimales
  await m.addItem('c4', { productId: 'a', name: 'a', price: 0.1, currency: 'EUR', quantity: 3 });
  console.log('0,10 × 3 =', m.getSummary((await m.getCart('c4'))!).subtotal);
  // 4. clearCart
  m.on('cart.cleared', e => console.log('cart.cleared payload:', e.payload));
  await m.clearCart('c4');
  // 5. Memoria: lo que devuelve getCart es el objeto guardado
  const c = (await m.getCart('c3'))!; c.items.length = 0;
  console.log('tras vaciar el objeto devuelto, el guardado tiene', (await m.getCart('c3'))!.items.length, 'líneas');
  // 6. Ruta con ../
  const f = new FileStorage('/tmp/cca-prueba/juez-data');
  await f.set({ id: '../fuera', items: [], createdAt: new Date(), updatedAt: new Date() });
  console.log('id "../fuera" escribe en', require('fs').existsSync('/tmp/cca-prueba/fuera.json') ? '/tmp/cca-prueba/fuera.json (fuera de la carpeta)' : 'dentro');
})();
