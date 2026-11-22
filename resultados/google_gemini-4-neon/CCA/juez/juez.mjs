// node juez/juez.mjs <copia-de-salida>   (Node ≥ 22.18: carga los .ts sin compilar, como su package.json)
// Las pruebas de siempre del juez de CCA, montadas con su createDefaultCartSystem (src/bootstrap.ts):
//   50 altas concurrentes del mismo producto; precio mandado por el cliente; cantidades raras; id con «../»;
//   0,10 × 3; monedas mezcladas; mutar el objeto devuelto; y dos instancias sobre el mismo FileCartRepository.
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2]);
const imp = f => import(pathToFileURL(path.join(dir, f)));
const { createDefaultCartSystem } = await imp('src/bootstrap.ts');
const { Money } = await imp('src/domain/money.ts');
const out = {};
const intenta = async f => { try { return ['ok', await f()]; } catch (e) { return ['error', `${e.code ?? e.name}: ${e.message}`.slice(0, 160)]; } };
const qty = (v, sku) => v.cart.items.find(i => i.sku === sku)?.quantity;

{
  const { cartService: s } = createDefaultCartSystem();
  const { cart } = await s.createCart({ currency: 'EUR' });
  const rs = await Promise.all(Array.from({ length: 50 }, () => intenta(() => s.addItem({ cartId: cart.id, sku: 'MOUSE-ERGO-01', quantity: 1 }))));
  const st = {}; rs.forEach(([k, v]) => { const key = k === 'ok' ? 'ok' : v.split(':')[0]; st[key] = (st[key] || 0) + 1; });
  out.altas_50 = { resultados: st, guardadas: qty(await s.getCart(cart.id), 'MOUSE-ERGO-01') };
}

const sys = createDefaultCartSystem();
const s = sys.cartService;
const { cart } = await s.createCart({ currency: 'EUR' });
const id = cart.id;
out.precio_del_cliente = await intenta(async () => {
  const v = await s.addItem({ cartId: id, sku: 'COFFEE-BEAN-1KG', quantity: 1, unitPrice: 0.01, price: 0.01, unitPriceMinor: 1 });
  return JSON.stringify(v.cart.items.find(i => i.sku === 'COFFEE-BEAN-1KG')).slice(0, 220);
});
for (const [k, q] of [['cantidad_0', 0], ['cantidad_negativa', -3], ['cantidad_decimal', 1.5], ['cantidad_enorme', 1e9]])
  out[k] = await intenta(() => s.addItem({ cartId: id, sku: 'KEYB-MECH-87', quantity: q }).then(() => 'aceptada'));
out.sku_con_puntos = await intenta(() => s.addItem({ cartId: id, sku: '../../etc/passwd', quantity: 1 }).then(() => 'aceptada'));
out.cartId_con_puntos = await intenta(() => s.getCart('../../etc/passwd').then(() => 'encontrado'));
out.cero_diez_por_tres = await intenta(async () => {
  sys.catalog.upsertProduct({ sku: 'DIEZ', name: 'Diez céntimos', category: 'x', price: Money.ofMajor(0.1, 'EUR'), active: true });
  sys.inventory.setStock('DIEZ', 100);
  const v = await s.addItem({ cartId: id, sku: 'DIEZ', quantity: 3 });
  const l = v.cart.items.find(i => i.sku === 'DIEZ');
  return `línea ${l.unitPriceMinor} × ${l.quantity}; subtotal ${JSON.stringify(v.pricing.subtotal ?? v.pricing.subtotalMinor)}`;
});
out.monedas_mezcladas = await intenta(async () => {
  const a = Money.ofMinor(100, 'EUR'), b = Money.ofMinor(100, 'USD');
  return a.add(b).toString();
});
out.carrito_usd_con_producto_eur = await intenta(async () => {
  const { cart: u } = await s.createCart({ currency: 'USD' });
  return s.addItem({ cartId: u.id, sku: 'KEYB-MECH-87', quantity: 1 }).then(() => 'aceptada');
});
out.mutar = await intenta(async () => {
  const a = await s.getCart(id);
  const antes = qty(a, 'MOUSE-ERGO-01') ?? qty(a, 'COFFEE-BEAN-1KG');
  const sku = a.cart.items[0].sku;
  try { a.cart.items[0].quantity = 999; } catch (e) { return 'la línea no se deja mutar: ' + e.message; }
  const b = await s.getCart(id);
  return `antes ${qty(a, sku) === 999 ? antes : '?'}; tras mutar la copia y releer: ${qty(b, sku)}`;
});

// Dos instancias (dos createDefaultCartSystem) con el mismo fichero: lo más parecido a dos réplicas que trae.
{
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'neon-')), 'carts.json');
  const A = createDefaultCartSystem({ storageMode: 'file', storageFilePath: f }).cartService;
  const B = createDefaultCartSystem({ storageMode: 'file', storageFilePath: f }).cartService;
  const { cart: c } = await A.createCart({ currency: 'EUR' });
  const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => intenta(() => (i % 2 ? A : B).addItem({ cartId: c.id, sku: 'MOUSE-ERGO-01', quantity: 1 }))));
  const st = {}; rs.forEach(([k, v]) => { const key = k === 'ok' ? 'ok' : v.split(':')[0]; st[key] = (st[key] || 0) + 1; });
  out.dos_instancias_fichero_20 = { resultados: st, guardadas: qty(await A.getCart(c.id), 'MOUSE-ERGO-01') };
}
console.log(JSON.stringify(out, null, 1));
