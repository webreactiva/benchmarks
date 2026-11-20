import {
  CartService,
  InMemoryCartRepository,
  InMemoryCatalog,
  EventBus,
  percentOffSku,
  buyXPayY,
  formatMoney,
  CartError,
} from '../src/index.js';

const catalog = new InMemoryCatalog([
  { sku: 'APPLE', name: 'Manzana', unitPriceCents: 150, currency: 'EUR' },
  { sku: 'MILK', name: 'Leche 1L', unitPriceCents: 99, currency: 'EUR' },
  { sku: 'BREAD', name: 'Pan', unitPriceCents: 299, currency: 'EUR' },
]);

const events = new EventBus();
events.on('item.added', ({ cartId, sku, version }) => {
  console.log(`  [evento] ${cartId} v${version}: +${sku}`);
});

const cartService = new CartService({
  repository: new InMemoryCartRepository(),
  catalog,
  events,
  pricing: {
    taxRateBps: 1000, // 10 %
    rules: [
      buyXPayY({ sku: 'APPLE', buy: 3, pay: 2 }), // 3x2 en manzanas
      percentOffSku({ sku: 'BREAD', percentBps: 500, name: '5 % pan' }),
    ],
  },
});

const cart = await cartService.createCart({ currency: 'EUR', id: 'demo-cart' });
console.log(`Carrito creado: ${cart.id} (${cart.currency})`);

await cartService.addItem('demo-cart', 'APPLE', 3);
await cartService.addItem('demo-cart', 'MILK', 2);
await cartService.addItem('demo-cart', 'BREAD', 1);
await cartService.setQuantity('demo-cart', 'MILK', 1);

try {
  await cartService.addItem('demo-cart', 'UNKNOWN');
} catch (error) {
  if (error instanceof CartError) console.log(`Error esperado: ${error.code} - ${error.message}`);
}

const t = await cartService.getTotals('demo-cart');
console.log('\nResumen:');
console.log(`  Artículos:   ${t.itemCount}`);
console.log(`  Subtotal:    ${formatMoney(t.subtotalCents, t.currency)}`);
for (const d of t.discounts) {
  console.log(`  - ${d.name}: -${formatMoney(d.amountCents, t.currency)}`);
}
console.log(`  Impuestos:   ${formatMoney(t.taxCents, t.currency)}`);
console.log(`  TOTAL:       ${formatMoney(t.totalCents, t.currency)}`);

// Esperar a que los suscriptores de eventos (asíncronos) terminen de imprimir.
await new Promise((resolve) => setImmediate(resolve));
