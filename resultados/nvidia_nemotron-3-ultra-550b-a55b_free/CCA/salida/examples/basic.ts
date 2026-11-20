import {
  CartService,
  createDefaultCartService,
  InMemoryStorage,
  InMemoryEventBus,
  FileStorage,
  Cart,
  CartItem,
} from '../src';

async function basicExample(): Promise<void> {
  console.log('=== Basic Shopping Cart Example ===\n');

  const cartService = createDefaultCartService();
  const cartId = 'user-123-cart';

  console.log('1. Adding items to cart...');
  await cartService.addItem(cartId, {
    productId: 'prod-001',
    name: 'Wireless Headphones',
    price: 149.99,
    currency: 'USD',
    quantity: 1,
  });

  await cartService.addItem(cartId, {
    productId: 'prod-002',
    name: 'Phone Case',
    price: 24.99,
    currency: 'USD',
    quantity: 2,
  });

  await cartService.addItem(cartId, {
    productId: 'prod-003',
    name: 'USB-C Cable',
    price: 12.99,
    currency: 'USD',
    quantity: 3,
  });

  console.log('2. Getting cart...');
  const cart = await cartService.getCart(cartId);
  if (cart) {
    console.log(`   Cart ID: ${cart.id}`);
    console.log(`   Items: ${cart.items.length}`);
    console.log(`   Created: ${cart.createdAt.toISOString()}`);
    console.log(`   Updated: ${cart.updatedAt.toISOString()}`);
  }

  console.log('\n3. Cart summary...');
  if (cart) {
    const summary = cartService.getSummary(cart);
    console.log(`   Item count: ${summary.itemCount}`);
    console.log(`   Total quantity: ${summary.totalQuantity}`);
    console.log(`   Subtotal: ${summary.currency} ${summary.subtotal.toFixed(2)}`);
  }

  console.log('\n4. Updating item quantity...');
  await cartService.updateItem(cartId, {
    productId: 'prod-002',
    quantity: 5,
  });

  const updatedCart = await cartService.getCart(cartId);
  if (updatedCart) {
    const summary = cartService.getSummary(updatedCart);
    console.log(`   Updated subtotal: ${summary.currency} ${summary.subtotal.toFixed(2)}`);
  }

  console.log('\n5. Removing item...');
  await cartService.removeItem(cartId, 'prod-003');

  const cartAfterRemove = await cartService.getCart(cartId);
  if (cartAfterRemove) {
    const summary = cartService.getSummary(cartAfterRemove);
    console.log(`   Items after removal: ${summary.itemCount}`);
    console.log(`   Subtotal: ${summary.currency} ${summary.subtotal.toFixed(2)}`);
  }

  console.log('\n6. Checking item existence...');
  if (cartAfterRemove) {
    console.log(`   Has prod-001: ${cartService.hasItem(cartAfterRemove, 'prod-001')}`);
    console.log(`   Has prod-003: ${cartService.hasItem(cartAfterRemove, 'prod-003')}`);
    console.log(`   Quantity of prod-001: ${cartService.getItemQuantity(cartAfterRemove, 'prod-001')}`);
  }

  console.log('\n7. Clearing cart...');
  await cartService.clearCart(cartId);

  const clearedCart = await cartService.getCart(cartId);
  if (clearedCart) {
    console.log(`   Items after clear: ${clearedCart.items.length}`);
  }

  console.log('\n=== Example completed ===');
}

async function eventExample(): Promise<void> {
  console.log('\n=== Event-Driven Example ===\n');

  const storage = new InMemoryStorage();
  const eventBus = new InMemoryEventBus();
  const cartService = new CartService({ storage, eventBus });
  const cartId = 'event-cart-456';

  eventBus.subscribe('item.added', async (event) => {
    console.log(`[EVENT] Item added: ${JSON.stringify(event.payload)}`);
  });

  eventBus.subscribe('item.updated', async (event) => {
    console.log(`[EVENT] Item updated: ${JSON.stringify(event.payload)}`);
  });

  eventBus.subscribe('item.removed', async (event) => {
    console.log(`[EVENT] Item removed: ${JSON.stringify(event.payload)}`);
  });

  eventBus.subscribe('cart.updated', async (event) => {
    console.log(`[EVENT] Cart updated, items: ${(event.payload as { cart: Cart }).cart.items.length}`);
  });

  eventBus.subscribe('cart.cleared', async (event) => {
    console.log(`[EVENT] Cart cleared: ${JSON.stringify(event.payload)}`);
  });

  console.log('Adding items with event listeners...');
  await cartService.addItem(cartId, {
    productId: 'prod-A',
    name: 'Product A',
    price: 10.00,
    currency: 'USD',
    quantity: 2,
  });

  await cartService.addItem(cartId, {
    productId: 'prod-B',
    name: 'Product B',
    price: 20.00,
    currency: 'USD',
    quantity: 1,
  });

  console.log('\nUpdating quantity...');
  await cartService.updateItem(cartId, {
    productId: 'prod-A',
    quantity: 5,
  });

  console.log('\nRemoving item...');
  await cartService.removeItem(cartId, 'prod-B');

  console.log('\nClearing cart...');
  await cartService.clearCart(cartId);

  console.log('\n=== Event example completed ===');
}

async function persistenceExample(): Promise<void> {
  console.log('\n=== File Persistence Example ===\n');

  const fileStorage = new FileStorage('./data/carts');
  const cartService = new CartService({ storage: fileStorage });
  const cartId = 'persistent-cart-789';

  console.log('Adding items to persistent cart...');
  await cartService.addItem(cartId, {
    productId: 'persist-1',
    name: 'Persistent Item 1',
    price: 99.99,
    currency: 'EUR',
    quantity: 1,
  });

  await cartService.addItem(cartId, {
    productId: 'persist-2',
    name: 'Persistent Item 2',
    price: 49.99,
    currency: 'EUR',
    quantity: 2,
  });

  const cart = await cartService.getCart(cartId);
  if (cart) {
    const summary = cartService.getSummary(cart);
    console.log(`Cart saved with ${summary.itemCount} items, total: ${summary.currency} ${summary.subtotal.toFixed(2)}`);
  }

  console.log('\nSimulating app restart - creating new service instance...');
  const newFileStorage = new FileStorage('./data/carts');
  const newCartService = new CartService({ storage: newFileStorage });

  const restoredCart = await newCartService.getCart(cartId);
  if (restoredCart) {
    const summary = newCartService.getSummary(restoredCart);
    console.log(`Cart restored with ${summary.itemCount} items, total: ${summary.currency} ${summary.subtotal.toFixed(2)}`);
    console.log('Items:');
    restoredCart.items.forEach((item) => {
      console.log(`  - ${item.name} x${item.quantity} @ ${item.currency} ${item.price}`);
    });
  }

  console.log('\n=== Persistence example completed ===');
}

async function advancedExample(): Promise<void> {
  console.log('\n=== Advanced Configuration Example ===\n');

  const storage = new InMemoryStorage();
  const cartService = new CartService({
    storage,
    maxItems: 3,
    maxQuantityPerItem: 10,
  });
  const cartId = 'advanced-cart';

  console.log('Testing max items limit (3)...');
  await cartService.addItem(cartId, {
    productId: 'p1', name: 'Item 1', price: 10, currency: 'USD', quantity: 1,
  });
  await cartService.addItem(cartId, {
    productId: 'p2', name: 'Item 2', price: 10, currency: 'USD', quantity: 1,
  });
  await cartService.addItem(cartId, {
    productId: 'p3', name: 'Item 3', price: 10, currency: 'USD', quantity: 1,
  });

  try {
    await cartService.addItem(cartId, {
      productId: 'p4', name: 'Item 4', price: 10, currency: 'USD', quantity: 1,
    });
    console.log('ERROR: Should have thrown!');
  } catch (error) {
    console.log(`   Correctly rejected: ${(error as Error).message}`);
  }

  console.log('\nTesting max quantity per item (10)...');
  try {
    await cartService.updateItem(cartId, { productId: 'p1', quantity: 15 });
    console.log('ERROR: Should have thrown!');
  } catch (error) {
    console.log(`   Correctly rejected: ${(error as Error).message}`);
  }

  await cartService.updateItem(cartId, { productId: 'p1', quantity: 10 });
  console.log('   Quantity 10 accepted');

  console.log('\n=== Advanced example completed ===');
}

async function main(): Promise<void> {
  await basicExample();
  await eventExample();
  await persistenceExample();
  await advancedExample();
}

main().catch(console.error);