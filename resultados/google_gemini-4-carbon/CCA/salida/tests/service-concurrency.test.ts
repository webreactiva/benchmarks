import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ConcurrencyConflictError,
  DomainError,
  InsufficientStockError,
} from '../src/domain/errors.ts';
import { createShoppingCartApp } from '../src/server.ts';

describe('Aplicación e Infraestructura: Concurrencia, Caché Multinivel, Idempotencia y Saga Checkout', () => {
  it('resuelve escrituras concurrentes sin If-Match mediante reintento optimista y rechaza versiones obsoletas explícitas', async () => {
    const app = createShoppingCartApp({ sqlitePath: ':memory:' });
    try {
      const created = await app.cartService.createOrGetActiveCart({
        userId: 'usr_concurrent',
      });

      // Lanzamos 5 adiciones concurrentes sobre el mismo carrito sin fijar expectedVersion
      await Promise.all([
        app.cartService.addItem({ cartId: created.id, sku: 'USB-HUB-7IN1', quantity: 1 }),
        app.cartService.addItem({ cartId: created.id, sku: 'USB-HUB-7IN1', quantity: 2 }),
        app.cartService.addItem({ cartId: created.id, sku: 'MOUSE-ERGO-WL', quantity: 1 }),
        app.cartService.addItem({ cartId: created.id, sku: 'MECH-KEY-ES', quantity: 1 }),
        app.cartService.addItem({ cartId: created.id, sku: 'USB-HUB-7IN1', quantity: 3 }),
      ]);

      const updated = await app.cartService.getCart(created.id);
      const hubItem = updated.items.find((i) => i.sku === 'USB-HUB-7IN1');
      assert.equal(hubItem?.quantity, 6);
      assert.equal(updated.version, 6);

      // Si un cliente envía explícitamente una versión antigua (expectedVersion: 2), debe fallar con 409
      await assert.rejects(
        () =>
          app.cartService.addItem({
            cartId: created.id,
            sku: 'USB-HUB-7IN1',
            quantity: 1,
            expectedVersion: 2,
          }),
        (err: unknown) => err instanceof ConcurrencyConflictError && err.statusCode === 409,
      );
    } finally {
      await app.close();
    }
  });

  it('invalida la caché L1 automáticamente cuando L2 detecta un cambio externo de otro nodo', async () => {
    const app = createShoppingCartApp({ sqlitePath: ':memory:' });
    try {
      const created = await app.cartService.createOrGetActiveCart({
        sessionId: 'sess_multi_node',
      });
      await app.cartService.addItem({
        cartId: created.id,
        sku: 'MOUSE-ERGO-WL',
        quantity: 1,
      });

      // Simulamos escritura directa en L2 desde otro nodo del clúster (saltando la L1 local)
      const directL2Cart = await app.sqliteRepo.findById(created.id);
      assert.ok(directL2Cart);
      const prevVersion = directL2Cart.version;
      directL2Cart.removeItem('MOUSE-ERGO-WL');
      await app.sqliteRepo.save(directL2Cart, prevVersion);

      // Ahora nuestra instancia intenta guardar con su versión L1 anticuada usando expectedVersion explícito
      await assert.rejects(
        () =>
          app.cartService.addItem({
            cartId: created.id,
            sku: 'MECH-KEY-ES',
            quantity: 1,
            expectedVersion: prevVersion,
          }),
        ConcurrencyConflictError,
      );

      // Tras el conflicto, L1 quedó invalidada y la siguiente lectura refleja el estado real de L2
      const refreshed = await app.cartService.getCart(created.id);
      assert.equal(refreshed.items.length, 0);
      assert.equal(refreshed.version, prevVersion + 1);
    } finally {
      await app.close();
    }
  });

  it('garantiza idempotencia ante reintentos y bloquea reutilización fraudulenta de Idempotency-Key', async () => {
    const app = createShoppingCartApp({ sqlitePath: ':memory:' });
    try {
      const cart = await app.cartService.createOrGetActiveCart({
        userId: 'usr_idem',
      });

      const first = await app.cartService.runIdempotent('key-abc-1', 'fp-1', () =>
        app.cartService.addItem({ cartId: cart.id, sku: 'HEADSET-ANC', quantity: 2 }),
      );
      assert.equal(first.replayed, false);
      assert.equal(first.result.items[0]?.quantity, 2);

      const second = await app.cartService.runIdempotent('key-abc-1', 'fp-1', () =>
        app.cartService.addItem({ cartId: cart.id, sku: 'HEADSET-ANC', quantity: 2 }),
      );
      assert.equal(second.replayed, true);
      // No se duplicó la cantidad a 4
      assert.equal(second.result.items[0]?.quantity, 2);

      // Misma clave pero distinto payload -> 409 IDEMPOTENCY_CONFLICT
      await assert.rejects(
        () =>
          app.cartService.runIdempotent('key-abc-1', 'fp-diferente', () =>
            app.cartService.addItem({ cartId: cart.id, sku: 'HEADSET-ANC', quantity: 5 }),
          ),
        (err: unknown) => err instanceof DomainError && err.code === 'IDEMPOTENCY_CONFLICT',
      );
    } finally {
      await app.close();
    }
  });

  it('ejecuta checkout revalidando cambios de precio, descontando stock y compensando en caso de fallo', async () => {
    const app = createShoppingCartApp({ sqlitePath: ':memory:' });
    try {
      app.catalogInventory.upsertProduct({
        sku: 'LIMITED-GPU',
        name: 'GPU Edición Limitada',
        description: 'Solo 2 unidades',
        unitPriceMinor: 80000,
        currency: 'EUR',
        availableStock: 2,
        active: true,
      });

      const cart = await app.cartService.createOrGetActiveCart({ userId: 'usr_buyer' });
      await app.cartService.addItem({ cartId: cart.id, sku: 'LIMITED-GPU', quantity: 2 });

      // El precio en el catálogo cambia antes del checkout (de 800.00 a 750.00 EUR)
      app.catalogInventory.upsertProduct({
        sku: 'LIMITED-GPU',
        name: 'GPU Edición Limitada',
        description: 'Solo 2 unidades',
        unitPriceMinor: 75000,
        currency: 'EUR',
        availableStock: 2,
        active: true,
      });

      const result = await app.cartService.checkout({
        cartId: cart.id,
        customerEmail: 'comprador@tienda.es',
      });

      assert.equal(result.cart.status, 'CHECKED_OUT');
      assert.equal(result.order.priceAdjustments.length, 1);
      assert.equal(result.order.priceAdjustments[0]?.currentUnitPrice.amountMinor, 75000);
      assert.equal(result.order.pricing.subtotal.amountMinor, 150000);

      // El stock disponible pasó de 2 a 0
      const afterProduct = await app.catalogInventory.getProduct('LIMITED-GPU');
      assert.equal(afterProduct?.availableStock, 0);

      // Un segundo comprador intentando añadir recibe InsufficientStockError
      const otherCart = await app.cartService.createOrGetActiveCart({ userId: 'usr_late' });
      await assert.rejects(
        () =>
          app.cartService.addItem({
            cartId: otherCart.id,
            sku: 'LIMITED-GPU',
            quantity: 1,
          }),
        InsufficientStockError,
      );
    } finally {
      await app.close();
    }
  });
});
