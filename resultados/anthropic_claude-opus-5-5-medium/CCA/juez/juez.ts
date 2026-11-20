// Script del juez (no del modelo). No hay servicio, API ni tests: se prueban las piezas que dejó.
// Desde una copia de salida/:  cd /tmp/cca-opus && cp <ruta>/juez/juez.ts . && node juez.ts
import { newCart, addLine, setLineQuantity, removeLine, DEFAULT_LIMITS as L } from './src/domain/cart.ts';
import { InMemoryCartRepository } from './src/repository/memory.ts';
import { InMemoryCatalog } from './src/catalog/memory.ts';
import { PricingEngine } from './src/pricing/pricing-engine.ts';
import { PromotionRegistry } from './src/pricing/promotions.ts';

const now = new Date().toISOString();
const p = (sku: string, price: number, currency = 'EUR') => ({ sku, name: sku, price, currency, active: true });
const cat = new InMemoryCatalog([...Array.from({ length: 50 }, (_, i) => p(`p${i}`, 100)), p('usd', 100, 'USD'), p('dec', 10)]);
const prods = await cat.getProducts([...Array.from({ length: 50 }, (_, i) => `p${i}`), 'usd', 'dec']);
const ok = (f: () => unknown) => { try { f(); return 'ACEPTADO'; } catch (e: any) { return 'rechazado ' + (e.code ?? e.name); } };

// No hay servicio que haga «leer → añadir → guardar con CAS» ni reintentos: el juez hace el bucle mínimo, sin reintentar.
const repo = new InMemoryCartRepository();
await repo.save(newCart({ id: 'c50', ownerId: null, currency: 'EUR', now }), 0, 3600);
const res = await Promise.allSettled(Array.from({ length: 50 }, async (_, i) => {
  const c = (await repo.get('c50'))!;
  const n = addLine(c, prods.get(`p${i}`)!, 1, L);
  await repo.save({ ...n, version: c.version + 1 }, c.version, 3600);
}));
const g = (await repo.get('c50'))!;
console.log(`50 altas a la vez (sin reintentos, no hay servicio): ok ${res.filter(r => r.status === 'fulfilled').length}, conflicto ${res.filter(r => r.status === 'rejected').length}; líneas guardadas ${g.lines.length}`);
// ojo: save no sube la versión; si quien llama no la sube, el CAS no protege nada
const r2 = new InMemoryCartRepository();
await r2.save(newCart({ id: 'v', ownerId: null, currency: 'EUR', now }), 0, 3600);
const a = (await r2.get('v'))!, b = (await r2.get('v'))!;
await r2.save(addLine(a, prods.get('p1')!, 1, L), a.version, 3600);
await r2.save(addLine(b, prods.get('p2')!, 1, L), b.version, 3600).then(() => console.log('save sin subir versión: la 2.ª escritura se acepta'), () => console.log('save sin subir versión: conflicto'));
console.log('  líneas tras dos escrituras sin subir versión:', (await r2.get('v'))!.lines.map(l => l.sku));

const eur = newCart({ id: 'x', ownerId: null, currency: 'EUR', now });
console.log('USD en carrito EUR:', ok(() => addLine(eur, prods.get('usd')!, 1, L)));
const d3 = addLine(eur, prods.get('dec')!, 3, L);
const t = new PricingEngine(new PromotionRegistry(), { taxRateBasisPoints: 0 }).price(d3);
console.log('0,10 × 3 =', t.subtotal, 'céntimos');
console.log('id ../fuera en newCart:', ok(() => newCart({ id: '../fuera', ownerId: null, currency: 'EUR', now })));
for (const q of [0, -1, 1.5, 100, 1e9]) console.log(`cantidad ${q}:`, ok(() => addLine(eur, prods.get('p1')!, q, L)));
const c1 = addLine(eur, prods.get('p1')!, 1, L);
console.log('objeto devuelto congelado:', Object.isFrozen(c1), Object.isFrozen(c1.lines));
await repo.save(c1, 0, 3600).catch(() => {});
const r3 = new InMemoryCartRepository(); await r3.save(c1, 0, 3600);
const got = (await r3.get(c1.id))!; (got.lines as any).push({ sku: 'x', unitPrice: 1, quantity: 9 });
console.log('tras tocar el objeto devuelto por get(), líneas en el almacén', (await r3.get(c1.id))!.lines.length);
console.log('set 0 / quitar:', setLineQuantity(c1, 'p1', 0, L).lines.length, removeLine(c1, 'p1').lines.length, '· vaciar: no hay función');
