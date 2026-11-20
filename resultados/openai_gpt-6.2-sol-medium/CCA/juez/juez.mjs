// node juez/juez.mjs <copia de salida>: las pruebas del juez sobre las funciones del carrito (no hay API: todo vive en el navegador)
import path from 'node:path';
const d = path.resolve(process.argv[2]);
const C = await import(d + '/public/js/cart.js'); const { catalog } = await import(d + '/public/js/catalog.js');
const ids = [...catalog.keys()]; let cart = C.normalizeCart({}, catalog);
// 50 altas «a la vez»: sin servidor, son 50 llamadas seguidas sobre el mismo estado
for (let i = 0; i < 50; i++) { const id = ids[i % ids.length]; cart = C.setQuantity(cart, catalog, id, (cart.items.get(id) ?? 0) + 1); }
console.log('50 altas → unidades', [...cart.items.values()].reduce((a, b) => a + b, 0), '(existencias:', ids.map(i => catalog.get(i).stock).join(','), ')');
console.log('precios en céntimos:', ids.map(i => catalog.get(i).price).join(','), '· moneda:', [...new Set(ids.map(i => catalog.get(i).currency ?? '—'))]);
const p = { items: new Map([[ids[0], 3]]), coupon: '' }; const cat = new Map(catalog); cat.set(ids[0], { ...catalog.get(ids[0]), price: 10 });
console.log('0,10 × 3 →', C.quoteCart(p, cat).subtotal, 'céntimos');
console.log('id con ../ →', C.setQuantity(cart, catalog, '../etc', 1) === cart ? 'ignorado' : 'aceptado');
console.log('cantidad -5, 1.5, 1e9 →', [-5, 1.5, 1e9].map(q => C.setQuantity(C.normalizeCart({}, catalog), catalog, ids[0], q).items.get(ids[0]) ?? 0));
console.log('localStorage manipulado (precio y cantidad) →', JSON.stringify(Object.fromEntries(C.readCart(JSON.stringify({ version: 1, items: { [ids[0]]: 2, falso: 3 }, price: 1 }), catalog).items)));
const q = C.quoteCart(cart, catalog); try { q.lines[0].product.price = 1; console.log('objeto devuelto mutable: sí, y cambia el catálogo →', catalog.get(q.lines[0].product.id).price); } catch { console.log('objeto devuelto: congelado'); }
