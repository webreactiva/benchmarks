import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildContainer } from '../src/container.js';
import { InMemoryCartRepository } from '../src/infrastructure/inMemoryCartRepository.js';
import { ConcurrencyError } from '../src/domain/errors.js';

let ctx;
beforeEach(async () => {
  ctx = await buildContainer({});
});

test('flujo completo: crear, añadir, cupón, ver totales', async () => {
  const { service, eventBus } = ctx;
  const cart = await service.create({ ownerId: 'u1' });
  await service.addItem(cart.id, { sku: 'CAMISETA-AZUL-M', quantity: 2 });
  await service.addItem(cart.id, { sku: 'CAMISETA-AZUL-M', quantity: 1 });
  const v = await service.applyCoupon(cart.id, 'bienvenida10');
  assert.equal(v.lines[0].quantity, 3);
  assert.equal(v.subtotal, 4500);
  assert.equal(v.discountTotal, 450);
  assert.equal(v.shipping, 499);
  assert.deepEqual(v.coupons, ['BIENVENIDA10']);
  assert.equal(v.version, 4);
  assert.deepEqual(eventBus.published.map((e) => e.type),
    ['cart.created', 'cart.item_added', 'cart.item_added', 'cart.coupon_applied']);
});

test('el precio viene del catálogo y se refresca al ver', async () => {
  const { service, catalog } = ctx;
  const cart = await service.create();
  await service.addItem(cart.id, { sku: 'TAZA-LOGO' });
  catalog.upsert({ sku: 'TAZA-LOGO', name: 'Taza con logo', price: 900, stock: 40 });
  const v = await service.view(cart.id);
  assert.equal(v.lines[0].unitPrice, 900);
  assert.deepEqual(v.warnings, [{ code: 'PRICE_CHANGED', sku: 'TAZA-LOGO', from: 800, to: 900 }]);

  catalog.upsert({ sku: 'TAZA-LOGO', name: 'x', price: 900, stock: 0, active: false });
  const v2 = await service.view(cart.id);
  assert.equal(v2.lines.length, 0);
  assert.equal(v2.warnings[0].code, 'PRODUCT_UNAVAILABLE');
});

test('errores de negocio: stock, producto inexistente, cupón inválido', async () => {
  const { service } = ctx;
  const cart = await service.create();
  await assert.rejects(service.addItem(cart.id, { sku: 'SUDADERA-GRIS-L', quantity: 16 }), { code: 'OUT_OF_STOCK' });
  await assert.rejects(service.addItem(cart.id, { sku: 'NO-EXISTE' }), { code: 'NOT_FOUND' });
  await assert.rejects(service.applyCoupon(cart.id, 'FALSO'), { code: 'NOT_FOUND' });
  await assert.rejects(service.view('nope'), { code: 'NOT_FOUND' });
});

test('concurrencia: 50 adiciones simultáneas no pierden actualizaciones', async () => {
  const { service } = ctx;
  const cart = await service.create();
  await Promise.all(Array.from({ length: 50 }, () => service.addItem(cart.id, { sku: 'PEGATINAS' })));
  const v = await service.view(cart.id);
  assert.equal(v.lines[0].quantity, 50);
  assert.equal(v.version, 51);
});

test('concurrencia: If-Match obsoleto devuelve conflicto sin reintentar', async () => {
  const { service } = ctx;
  const cart = await service.create();
  await service.addItem(cart.id, { sku: 'PEGATINAS' }, { expectedVersion: 1 });
  await assert.rejects(service.addItem(cart.id, { sku: 'PEGATINAS' }, { expectedVersion: 1 }), ConcurrencyError);
});

test('el repositorio rechaza escrituras con versión obsoleta y caduca por TTL', async () => {
  let t = 0;
  const repo = new InMemoryCartRepository({ ttlMs: 10, now: () => t });
  const saved = await repo.save({ id: 'x', items: [] }, 0);
  assert.equal(saved.version, 1);
  await assert.rejects(repo.save({ id: 'x', items: [] }, 0), ConcurrencyError);
  t = 20;
  assert.equal(await repo.get('x'), null);
});

test('merge: fusiona invitado en usuario, limita por stock y borra el origen', async () => {
  const { service } = ctx;
  const guest = await service.create();
  const user = await service.create({ ownerId: 'u1' });
  await service.addItem(guest.id, { sku: 'SUDADERA-GRIS-L', quantity: 10 });
  await service.addItem(guest.id, { sku: 'TAZA-LOGO', quantity: 1 });
  await service.applyCoupon(guest.id, 'MENOS5');
  await service.addItem(user.id, { sku: 'SUDADERA-GRIS-L', quantity: 10 });
  const merged = await service.merge(user.id, guest.id);
  const q = Object.fromEntries(merged.lines.map((l) => [l.sku, l.quantity]));
  assert.deepEqual(q, { 'SUDADERA-GRIS-L': 15, 'TAZA-LOGO': 1 });
  assert.deepEqual(merged.coupons, ['MENOS5']);
  await assert.rejects(service.view(guest.id), { code: 'NOT_FOUND' });
});

test('updateItem a 0 elimina; clear vacía', async () => {
  const { service } = ctx;
  const cart = await service.create();
  await service.addItem(cart.id, { sku: 'TAZA-LOGO', quantity: 2 });
  await service.addItem(cart.id, { sku: 'PEGATINAS', quantity: 2 });
  let v = await service.updateItem(cart.id, 'TAZA-LOGO', 0);
  assert.equal(v.lines.length, 1);
  v = await service.clear(cart.id);
  assert.equal(v.lines.length, 0);
  assert.equal(v.total, 0);
});
