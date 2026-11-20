import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog.js';
import {
  CartItemNotFoundError,
  CartNotFoundError,
  DiscountMinSubtotalError,
  EmptyCartError,
  InvalidDiscountCodeError,
  OutOfStockError,
  ProductNotFoundError,
} from '../src/domain/errors.js';
import { buildService } from './helpers.js';

describe('CartService', () => {
  it('crea un carrito vacío con desglose a cero', async () => {
    const { service } = buildService(CATALOG);
    const cart = await service.createCart();
    expect(cart.id).toMatch(/^c_/);
    expect(cart.items).toEqual([]);
    expect(cart.itemCount).toBe(0);
    expect(cart.summary.totalCents).toBe(0);
  });

  it('añade productos y fusiona cantidades de la misma línea', async () => {
    const { service } = buildService(CATALOG);
    const cart = await service.createCart();
    await service.addItem(cart.id, 'p-raton', 2);
    const view = await service.addItem(cart.id, 'p-raton', 1);
    expect(view.items).toHaveLength(1);
    expect(view.items[0]!.quantity).toBe(3);
    expect(view.itemCount).toBe(3);
    expect(view.items[0]!.lineTotalCents).toBe(3 * 2999);
  });

  it('calcula el desglose desde los precios del catálogo, nunca del cliente', async () => {
    const { service } = buildService(CATALOG);
    const cart = await service.createCart();
    const view = await service.addItem(cart.id, 'p-teclado', 1);
    expect(view.items[0]!.unitPriceCents).toBe(8990);
    expect(view.summary.subtotalCents).toBe(8990);
  });

  it('rechaza productos y carritos inexistentes', async () => {
    const { service } = buildService(CATALOG);
    const cart = await service.createCart();
    await expect(service.addItem(cart.id, 'p-fantasma', 1)).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
    await expect(service.getCart('c_inexistente')).rejects.toBeInstanceOf(CartNotFoundError);
  });

  it('rechaza cantidades sin stock suficiente y no modifica el carrito', async () => {
    const { service } = buildService(CATALOG);
    const cart = await service.createCart();
    const raton = CATALOG.find((p) => p.id === 'p-raton')!;
    await expect(service.addItem(cart.id, 'p-raton', raton.stock + 1)).rejects.toBeInstanceOf(
      OutOfStockError,
    );
    const view = await service.getCart(cart.id);
    expect(view.items).toHaveLength(0);
  });

  it('setQuantity actualiza la línea y con 0 la elimina', async () => {
    const { service } = buildService(CATALOG);
    const cart = await service.createCart();
    await service.addItem(cart.id, 'p-raton', 2);
    let view = await service.setQuantity(cart.id, 'p-raton', 5);
    expect(view.items[0]!.quantity).toBe(5);
    view = await service.setQuantity(cart.id, 'p-raton', 0);
    expect(view.items).toEqual([]);
  });

  it('setQuantity sobre una línea que no existe da CART_ITEM_NOT_FOUND', async () => {
    const { service } = buildService(CATALOG);
    const cart = await service.createCart();
    await expect(service.setQuantity(cart.id, 'p-raton', 2)).rejects.toBeInstanceOf(
      CartItemNotFoundError,
    );
  });

  it('removeItem elimina la línea y clearCart vacía todo', async () => {
    const { service } = buildService(CATALOG);
    const cart = await service.createCart();
    await service.addItem(cart.id, 'p-raton', 1);
    await service.addItem(cart.id, 'p-hub', 1);
    let view = await service.removeItem(cart.id, 'p-raton');
    expect(view.items.map((i) => i.productId)).toEqual(['p-hub']);
    await expect(service.removeItem(cart.id, 'p-raton')).rejects.toBeInstanceOf(
      CartItemNotFoundError,
    );
    view = await service.clearCart(cart.id);
    expect(view.items).toEqual([]);
  });

  it('aplica y quita códigos de descuento con validación completa', async () => {
    const { service } = buildService(CATALOG);
    const cart = await service.createCart();
    await service.addItem(cart.id, 'p-teclado', 1); // 89,90 €
    await expect(service.applyDiscount(cart.id, 'NOEXISTE')).rejects.toBeInstanceOf(
      InvalidDiscountCodeError,
    );
    let view = await service.applyDiscount(cart.id, 'diez'); // insensible a mayúsculas
    expect(view.summary.discountCode).toBe('DIEZ');
    expect(view.summary.discountCents).toBe(899);
    view = await service.removeDiscount(cart.id);
    expect(view.summary.discountCode).toBeNull();
    expect(view.summary.discountCents).toBe(0);
  });

  it('rechaza códigos cuyo mínimo de compra no se alcanza', async () => {
    const { service } = buildService(CATALOG);
    const cart = await service.createCart();
    await service.addItem(cart.id, 'p-hub', 1); // 24,95 € < mínimo de 25 € para CINCO
    await expect(service.applyDiscount(cart.id, 'CINCO')).rejects.toBeInstanceOf(
      DiscountMinSubtotalError,
    );
  });

  it('checkout descuenta stock, vacía el carrito y devuelve el pedido', async () => {
    const { service, products } = buildService(CATALOG);
    const cart = await service.createCart();
    await service.addItem(cart.id, 'p-raton', 2);
    const result = await service.checkout(cart.id);
    expect(result.order.id).toMatch(/^o_/);
    expect(result.order.itemCount).toBe(2);
    expect(result.order.totalCents).toBeGreaterThan(0);
    expect(result.cart.items).toEqual([]);
    const raton = await products.findById('p-raton');
    expect(raton!.stock).toBe(CATALOG.find((p) => p.id === 'p-raton')!.stock - 2);
    await expect(service.checkout(cart.id)).rejects.toBeInstanceOf(EmptyCartError);
  });

  it('compensa el stock si el checkout falla a mitad de camino', async () => {
    const { service, products } = buildService(CATALOG);
    const cart = await service.createCart();
    await service.addItem(cart.id, 'p-raton', 2);
    await service.addItem(cart.id, 'p-hub', 2);
    // El stock baja DESPUÉS de añadir (simula una compra concurrente).
    await products.adjustStock('p-hub', -49); // el hub queda en 1
    await expect(service.checkout(cart.id)).rejects.toBeInstanceOf(OutOfStockError);
    // El ratón ya se había descontado: la compensación lo devuelve.
    const raton = await products.findById('p-raton');
    expect(raton!.stock).toBe(CATALOG.find((p) => p.id === 'p-raton')!.stock);
    // Y el carrito sigue intacto para que el cliente reintente.
    const view = await service.getCart(cart.id);
    expect(view.items).toHaveLength(2);
  });
});
