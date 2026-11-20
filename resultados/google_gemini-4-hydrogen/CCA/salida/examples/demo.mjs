import {
  BuyXGetYRule,
  CartService,
  CategoryTaxStrategy,
  FreeThresholdShippingStrategy,
  InMemoryCartRepository,
  InMemoryCatalogAdapter,
  InMemoryEventBus,
  InMemoryIdempotencyStore,
  InMemoryInventoryAdapter,
  Money,
  PercentageDiscountRule,
  PricingEngine,
  PromotionRegistry,
} from '../dist/index.js';

async function main() {
  const catalog = new InMemoryCatalogAdapter([
    {
      productId: 'keyboard_pro',
      variantId: 'es_iso',
      sku: 'KBD-ES-01',
      name: 'Teclado Mecánico Pro (ISO-ES)',
      categoryId: 'perifericos',
      taxCategory: 'STANDARD',
      unitPrice: Money.fromMajor(120, 'EUR'),
      weightGrams: 850,
      active: true,
    },
    {
      productId: 'book_ddd',
      sku: 'BOOK-DDD-01',
      name: 'Domain-Driven Design',
      categoryId: 'libros',
      taxCategory: 'SUPER_REDUCED',
      unitPrice: Money.fromMajor(35, 'EUR'),
      weightGrams: 500,
      active: true,
    },
  ]);

  const inventory = new InMemoryInventoryAdapter({
    'KBD-ES-01': 15,
    'BOOK-DDD-01': 20,
  });

  const promotionRegistry = new PromotionRegistry();
  promotionRegistry.register(
    new BuyXGetYRule({
      id: 'books_3x2',
      name: '3x2 en Libros',
      buyQuantity: 2,
      freeQuantity: 1,
      categoryIds: ['libros'],
      stackable: true,
      priority: 10,
    }),
  );
  promotionRegistry.register(
    new PercentageDiscountRule({
      id: 'cup_tech10',
      name: '10% en Periféricos',
      percentage: 10,
      categoryIds: ['perifericos'],
      couponCode: 'TECH10',
      stackable: true,
      priority: 20,
    }),
  );

  const pricingEngine = new PricingEngine({
    promotionRegistry,
    taxStrategy: new CategoryTaxStrategy({
      STANDARD: 21,
      SUPER_REDUCED: 4,
    }),
    shippingStrategy: new FreeThresholdShippingStrategy({
      flatRate: Money.fromMajor(6.95, 'EUR'),
      freeThreshold: Money.fromMajor(150, 'EUR'),
    }),
  });

  const eventBus = new InMemoryEventBus();
  eventBus.subscribe((event) => {
    console.log(`[EVENTO] ${event.type} (v${event.version}) ->`, JSON.stringify(event.payload));
  });

  const cartService = new CartService({
    cartRepository: new InMemoryCartRepository(),
    catalog,
    inventory,
    pricingEngine,
    promotionRegistry,
    eventBus,
    idempotencyStore: new InMemoryIdempotencyStore(),
  });

  // 1. Sesión de invitado
  const guestCart = await cartService.createCart({ currency: 'EUR' });
  await cartService.addItem({
    cartId: guestCart.id,
    productId: 'keyboard_pro',
    variantId: 'es_iso',
    quantity: 1,
  });

  // 2. Usuario inicia sesión y fusiona su carrito
  const mergedSummary = await cartService.mergeGuestCart({
    guestCartId: guestCart.id,
    userId: 'usr_ana_2026',
  });

  // 3. Añade 3 libros (aplica 3x2 automático) y aplica cupón TECH10
  await cartService.addItem({
    cartId: mergedSummary.cartId,
    productId: 'book_ddd',
    quantity: 3,
  });
  const finalSummary = await cartService.applyCoupon(mergedSummary.cartId, 'TECH10');

  console.log('\n--- RESUMEN DEL CARRITO ---');
  for (const line of finalSummary.lines) {
    console.log(
      `- ${line.name} x${line.quantity}: bruto ${line.grossSubtotal.format()} | dto ${line.discount.format()} | neto ${line.netSubtotal.format()}`,
    );
  }
  console.log(`Subtotal bruto : ${finalSummary.grossSubtotal.format()}`);
  console.log(`Descuentos     : -${finalSummary.totalDiscount.format()}`);
  console.log(`Subtotal neto  : ${finalSummary.netSubtotal.format()}`);
  console.log(`Impuestos      : ${finalSummary.tax.totalTax.format()}`);
  console.log(
    `Envío          : ${finalSummary.shipping.cost.format()} (gratis: ${finalSummary.shipping.freeShippingApplied})`,
  );
  console.log(`TOTAL FINAL    : ${finalSummary.grandTotal.format()}`);

  // 4. Checkout atómico e idempotente
  const receipt = await cartService.checkout({
    cartId: finalSummary.cartId,
    idempotencyKey: 'checkout-demo-001',
  });
  console.log('\n--- COMPRA FINALIZADA ---');
  console.log(`Pedido: ${receipt.orderId} | Total cobrado: ${(receipt.grandTotalMinor / 100).toFixed(2)} ${receipt.currency}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
