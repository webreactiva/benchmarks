import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  CartService,
  InMemoryCartRepository,
  InMemoryCatalog,
  EventBus,
  CartError,
  ErrorCodes,
  percentOffSku,
} from '../src/index.js';

const products = [
  { sku: 'APPLE', name: 'Manzana', unitPriceCents: 150, currency: 'EUR' },
  { sku: 'BREAD', name: 'Pan', unitPriceCents: 299, currency: 'EUR' },
];

function makeService(overrides = {}) {
  const repository = overrides.repository ?? new InMemoryCartRepository();
  const catalog = new InMemoryCatalog(products);
  const events = new EventBus();
  events.onError = () => {}; // silenciar en tests
  return {
    repository,
    events,
    service: new CartService({
      repository,
      catalog,
      events,
      pricing: { taxRateBps: 1000, rules: [percentOffSku({ sku: 'APPLE', percentBps: 1000 })] },
      ...overrides.config,
    }),
  };
}

const waitForEvents = () => new Promise((resolve) => setImmediate(resolve));

describe('CartService', () => {
  test('flujo completo: crear, añadir, cambiar, totales', async () => {
    const { service } = makeService();
    const created = await service.createCart({ currency: 'EUR', id: 'cart-1' });
    assert.equal(created.version, 0);

    await service.addItem('cart-1', 'APPLE', 2);
    await service.addItem('cart-1', 'BREAD', 1);
    await service.setQuantity('cart-1', 'APPLE', 4);

    const totals = await service.getTotals('cart-1');
    assert.equal(totals.subtotalCents, 4 * 150 + 299);
    assert.equal(totals.discountCents, 60);
    assert.equal(totals.taxCents, Math.round((899 - 60) * 0.1));
    assert.equal(totals.totalCents, totals.taxableCents + totals.taxCents);

    const cart = await service.getCart('cart-1');
    assert.equal(cart.version, 3);
  });

  test('genera id si no se proporciona', async () => {
    const { service } = makeService();
    const c = await service.createCart({ currency: 'EUR' });
    assert.match(c.id, /^[0-9a-f-]{36}$/);
  });

  test('errores de negocio: carrito y producto inexistentes', async () => {
    const { service } = makeService();
    await assert.rejects(service.getCart('nope'), { code: ErrorCodes.CART_NOT_FOUND });
    await service.createCart({ currency: 'EUR', id: 'c' });
    await assert.rejects(service.addItem('c', 'GHOST'), { code: ErrorCodes.PRODUCT_NOT_FOUND });
    await assert.rejects(service.setQuantity('c', 'APPLE', 1), { code: ErrorCodes.ITEM_NOT_FOUND });
  });

  test('un fallo de validación no modifica el carrito', async () => {
    const { service } = makeService();
    await service.createCart({ currency: 'EUR', id: 'c' });
    await service.addItem('c', 'APPLE', 1);
    await assert.rejects(service.addItem('c', 'APPLE', 200), (e) => e instanceof CartError);
    assert.equal((await service.getCart('c')).version, 1);
  });

  test('emite eventos tras cada escritura confirmada', async () => {
    const { service, events } = makeService();
    const seen = [];
    events.on('item.added', (p) => seen.push(p));
    events.on('cart.created', (p) => seen.push(p));
    await service.createCart({ currency: 'EUR', id: 'c' });
    await service.addItem('c', 'APPLE', 1);
    await waitForEvents();
    assert.deepEqual(seen.map((e) => e.cartId), ['c', 'c']);
    assert.equal(seen[1].version, 1);
  });

  test('un handler que falla no rompe la operación ni a otros suscriptores', async () => {
    const { service, events } = makeService();
    let ok = 0;
    events.on('cart.created', () => { throw new Error('boom'); });
    events.on('cart.created', () => { ok++; });
    await service.createCart({ currency: 'EUR', id: 'c' });
    await waitForEvents();
    assert.equal(ok, 1);
  });

  test('concurrencia: operaciones simultáneas sobre el mismo carrito no pierden escrituras', async () => {
    // Con N escrituras simultáneas, el peor caso son N-1 reintentos por operación.
    const { service } = makeService({ config: { maxRetries: 30 } });
    await service.createCart({ currency: 'EUR', id: 'shared' });
    // 20 añadidos concurrentes: sin control optimista se perderían actualizaciones.
    await Promise.all(Array.from({ length: 20 }, () => service.addItem('shared', 'APPLE', 1)));
    const cart = await service.getCart('shared');
    assert.equal(cart.lines[0].quantity, 20);
    assert.equal(cart.version, 20); // createCart deja la versión 0; cada añadido suma 1
  });

  test('reintenta ante CONCURRENCY_CONFLICT y acaba teniendo éxito', async () => {
    const repository = new InMemoryCartRepository();
    let failuresLeft = 2;
    const flaky = {
      get: (id) => repository.get(id),
      create: (c) => repository.create(c),
      save: async (c) => {
        if (failuresLeft-- > 0) throw new CartError(ErrorCodes.CONCURRENCY_CONFLICT, 'simulated');
        return repository.save(c);
      },
    };
    const { service } = makeService({ repository: flaky });
    await service.createCart({ currency: 'EUR', id: 'c' });
    await service.addItem('c', 'BREAD', 1);
    assert.equal((await repository.get('c')).lines[0].quantity, 1);
  });

  test('si los reintentos se agotan, propaga CONCURRENCY_CONFLICT', async () => {
    const repository = new InMemoryCartRepository();
    const alwaysConflict = {
      get: (id) => repository.get(id),
      create: (c) => repository.create(c),
      save: async () => { throw new CartError(ErrorCodes.CONCURRENCY_CONFLICT, 'always'); },
    };
    const { service } = makeService({ repository: alwaysConflict, config: { maxRetries: 2 } });
    await repository.create({ id: 'c', currency: 'EUR', lines: [], version: 0 });
    await assert.rejects(service.addItem('c', 'BREAD', 1), { code: ErrorCodes.CONCURRENCY_CONFLICT });
  });

  test('catálogo: getProducts se llama una vez por operación de añadido', async () => {
    const catalog = new InMemoryCatalog(products);
    let calls = 0;
    const original = catalog.getProducts.bind(catalog);
    catalog.getProducts = async (skus) => { calls++; return original(skus); };
    const service = new CartService({ repository: new InMemoryCartRepository(), catalog, events: new EventBus() });
    await service.createCart({ currency: 'EUR', id: 'c' });
    await service.addItem('c', 'APPLE', 1);
    assert.equal(calls, 1);
  });
});
