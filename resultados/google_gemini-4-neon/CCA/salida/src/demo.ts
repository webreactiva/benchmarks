import { createDefaultCartSystem } from "./bootstrap.ts";

async function runDemo(): Promise<void> {
  const { cartService, eventBus, inventory } = createDefaultCartSystem();

  const eventsLog: string[] = [];
  eventBus.subscribeAll((event) => {
    eventsLog.push(`${event.type} (cart=${event.cartId}, v=${event.cartVersion})`);
  });

  console.log("=== Demo: Carrito de la Compra Escalable ===\n");

  // 1. Carrito de invitado + carrito de usuario autenticado
  const guest = await cartService.createCart({ currency: "EUR", shippingRegion: "ES" });
  const user = await cartService.createCart({
    ownerId: "user_42",
    currency: "EUR",
    shippingRegion: "ES",
  });

  // 2. Añadidos concurrentes (idempotencia + lock por carrito)
  await Promise.all([
    cartService.addItem({ cartId: guest.cart.id, sku: "TSHIRT-DEV-M", quantity: 3 }), // Aplica 3x2
    cartService.addItem({ cartId: guest.cart.id, sku: "COFFEE-BEAN-1KG", quantity: 2 }), // Exento IVA
    cartService.addItem({ cartId: user.cart.id, sku: "MOUSE-ERGO-01", quantity: 3 }), // Descuento volumen 10%
  ]);

  // 3. Fusión de carrito invitado -> usuario al iniciar sesión
  const merged = await cartService.mergeCarts({
    sourceCartId: guest.cart.id,
    targetCartId: user.cart.id,
    idempotencyKey: "demo-merge-1",
  });

  // 4. Aplicar cupón promocional
  const withCoupon = await cartService.applyCoupon({
    cartId: merged.cart.id,
    code: "WELCOME10",
  });

  console.log("Resumen del carrito tras fusión y cupón WELCOME10:");
  console.log(`- Cart ID: ${withCoupon.cart.id} (v${withCoupon.cart.version})`);
  console.log(`- Subtotal:         ${withCoupon.pricing.subtotal.formatted}`);
  console.log(`- Descuento líneas: -${withCoupon.pricing.lineDiscountTotal.formatted}`);
  console.log(`- Descuento cupón:  -${withCoupon.pricing.cartDiscountTotal.formatted}`);
  console.log(`- Impuestos (21%):  ${withCoupon.pricing.taxTotal.formatted}`);
  console.log(`- Envío:            ${withCoupon.pricing.shippingTotal.formatted}`);
  console.log(`- TOTAL:            ${withCoupon.pricing.grandTotal.formatted}`);
  console.log("- Promociones aplicadas:");
  for (const promo of withCoupon.pricing.appliedPromotions) {
    console.log(`    * ${promo.description} (-${promo.discount.formatted})`);
  }

  // 5. Checkout idempotente (dos intentos con la misma clave devuelven el mismo pedido)
  const checkout1 = await cartService.checkout({
    cartId: withCoupon.cart.id,
    idempotencyKey: "demo-checkout-1",
  });
  const checkout2 = await cartService.checkout({
    cartId: withCoupon.cart.id,
    idempotencyKey: "demo-checkout-1",
  });

  console.log(`\nCheckout completado: orderId=${checkout1.orderId}`);
  console.log(`Idempotencia verificada (mismo orderId en reintento): ${checkout1.orderId === checkout2.orderId}`);
  console.log(`Stock restante MOUSE-ERGO-01: ${await inventory.getAvailableStock("MOUSE-ERGO-01")}`);
  console.log(`\nEventos de dominio emitidos (${eventsLog.length}):`);
  for (const entry of eventsLog) {
    console.log(`  - ${entry}`);
  }
}

await runDemo();
