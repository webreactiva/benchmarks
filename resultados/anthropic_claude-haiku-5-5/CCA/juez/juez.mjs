import { CartService, InMemoryCartRepository, InMemoryCatalog } from './src/index.js';
const catalog = new InMemoryCatalog([
  ...Array.from({ length: 50 }, (_, i) => ({ sku: 'P' + i, name: 'x', unitPriceCents: 100, currency: 'EUR' })),
  { sku: 'USD1', name: 'y', unitPriceCents: 1000, currency: 'USD' },
  { sku: 'DEC', name: 'z', unitPriceCents: 10, currency: 'EUR' },
]);
const mk = (maxRetries) => new CartService({ repository: new InMemoryCartRepository(), catalog, maxRetries });
// 1. concurrencia: 50 addItem a la vez, SKUs distintos
let s = mk(); await s.createCart({ currency: 'EUR', id: 'c1' });
let r = await Promise.allSettled(Array.from({ length: 50 }, (_, i) => s.addItem('c1', 'P' + i, 1)));
console.log('concurrencia (maxRetries 5): ok', r.filter(x => x.status === 'fulfilled').length, 'rechazadas', r.filter(x => x.status === 'rejected').length,
  '· líneas guardadas', (await s.getCart('c1')).lines.length, '·', r.find(x => x.status === 'rejected')?.reason?.code ?? '');
s = mk(100); await s.createCart({ currency: 'EUR', id: 'c1' });
r = await Promise.allSettled(Array.from({ length: 50 }, () => s.addItem('c1', 'P0', 1)));
console.log('mismo SKU, maxRetries 100: cantidad', (await s.getCart('c1')).lines[0].quantity, 'de 50');
// 2. moneda distinta
s = mk(); await s.createCart({ currency: 'EUR', id: 'c2' });
try { await s.addItem('c2', 'USD1', 1); console.log('USD en carrito EUR: ACEPTADO', await s.getTotals('c2')); } catch (e) { console.log('USD en carrito EUR: rechazado', e.code); }
// 3. decimales
await s.addItem('c2', 'DEC', 3); console.log('0,10 × 3 =', (await s.getTotals('c2')).subtotalCents, 'céntimos');
// 4. id con ../
try { await s.createCart({ currency: 'EUR', id: '../fuera' }); console.log('id ../ aceptado'); } catch (e) { console.log('id ../ rechazado', e.code); }
// 5. el carrito devuelto es inmutable
const c = await s.getCart('c2'); try { c.lines.length = 0; } catch (e) {} console.log('tras tocar el objeto devuelto, líneas', (await s.getCart('c2')).lines.length);
