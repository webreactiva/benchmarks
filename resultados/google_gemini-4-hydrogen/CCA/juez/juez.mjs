// node juez/juez.mjs <copia-de-salida>   (después de npm run build en la copia)
// Las pruebas de siempre del juez de CCA, contra la librería compilada (dist/), montada como en examples/demo.mjs:
//   50 altas concurrentes del mismo producto en el mismo carrito; precio mandado por el cliente; cantidades raras;
//   id con «../»; 0,10 × 3; monedas mezcladas; mutar el objeto devuelto.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2]);
const L = await import(pathToFileURL(path.join(dir, 'dist/index.js')));
const { CartService, InMemoryCartRepository, InMemoryCatalogAdapter, InMemoryInventoryAdapter, InMemoryEventBus,
  InMemoryIdempotencyStore, PricingEngine, PromotionRegistry, CategoryTaxStrategy, FreeThresholdShippingStrategy, Money } = L;
const monta = () => {
  const catalog = new InMemoryCatalogAdapter([
    { productId: 'p1', sku: 'P1', name: 'Producto 1', categoryId: 'c', taxCategory: 'STANDARD', unitPrice: Money.fromMajor(10, 'EUR'), weightGrams: 100, active: true },
    { productId: 'p2', sku: 'P2', name: 'Producto 2', categoryId: 'c', taxCategory: 'STANDARD', unitPrice: Money.fromMajor(0.1, 'EUR'), weightGrams: 100, active: true },
  ]);
  const promotionRegistry = new PromotionRegistry();
  const pricingEngine = new PricingEngine({ promotionRegistry, taxStrategy: new CategoryTaxStrategy({ STANDARD: 21 }),
    shippingStrategy: new FreeThresholdShippingStrategy({ flatRate: Money.fromMajor(5, 'EUR'), freeThreshold: Money.fromMajor(100, 'EUR') }) });
  return new CartService({ cartRepository: new InMemoryCartRepository(), catalog, inventory: new InMemoryInventoryAdapter({ P1: 1000, P2: 1000 }),
    pricingEngine, promotionRegistry, eventBus: new InMemoryEventBus(), idempotencyStore: new InMemoryIdempotencyStore() });
};
const out = {};
const intenta = async f => { try { return ['ok', await f()]; } catch (e) { return ['error', `${e.code ?? e.name}: ${e.message}`.slice(0, 160)]; } };
{
  const s = monta();
  const c = await s.createCart({ currency: 'EUR' });
  const id = c.id ?? c.cartId;
  const rs = await Promise.all(Array.from({ length: 50 }, () => intenta(() => s.addItem({ cartId: id, productId: 'p1', quantity: 1 }))));
  const st = {}; rs.forEach(([k, v]) => { const key = k === 'ok' ? 'ok' : v.split(':')[0]; st[key] = (st[key] || 0) + 1; });
  const cart = await s.getCart(id);
  out.altas_50 = { resultados: st, guardadas: cart.getItem('p1')?.quantity };
}
const s = monta();
const c = await s.createCart({ currency: 'EUR' });
const id = c.id ?? c.cartId;
out.precio_del_cliente = await intenta(async () => {
  const r = await s.addItem({ cartId: id, productId: 'p1', quantity: 1, unitPrice: Money.fromMajor(0.01, 'EUR'), price: 0.01 });
  return JSON.stringify(r).slice(0, 200);
});
for (const [k, q] of [['cantidad_0', 0], ['cantidad_negativa', -3], ['cantidad_decimal', 1.5], ['cantidad_enorme', 1e9]])
  out[k] = await intenta(() => s.addItem({ cartId: id, productId: 'p1', quantity: q }).then(() => 'aceptada'));
out.producto_con_puntos = await intenta(() => s.addItem({ cartId: id, productId: '../../etc/passwd', quantity: 1 }).then(() => 'aceptada'));
out.cartId_con_puntos = await intenta(() => s.getCart('../../etc/passwd').then(() => 'encontrado'));
out.cero_diez_por_tres = await intenta(async () => { await s.addItem({ cartId: id, productId: 'p2', quantity: 3 }); return JSON.stringify((await s.getCart(id)).getItem('p2')).slice(0, 300); });
out.monedas_mezcladas = await intenta(() => Money.fromMajor(1, 'EUR').add(Money.fromMajor(1, 'USD')).toString());
out.mutar = await intenta(async () => {
  const a = await s.getCart(id);
  const antes = a.getItem('p1')?.quantity;
  try { a.getItem('p1').quantity = 999; } catch (e) { return 'la línea no se deja mutar: ' + e.message; }
  try { a.addItem && a.items?.push?.({}); } catch {}
  const b = await s.getCart(id);
  return `antes ${antes}; tras mutar la copia y releer: ${b.getItem('p1')?.quantity}`;
});
console.log(JSON.stringify(out, null, 1));
