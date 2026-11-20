import { CartService, InMemoryStorage, InMemoryEventBus } from '../src';

describe('CartService', () => {
  let cartService: CartService;
  let storage: InMemoryStorage;
  let eventBus: InMemoryEventBus;
  const cartId = 'test-cart';

  beforeEach(() => {
    storage = new InMemoryStorage();
    eventBus = new InMemoryEventBus();
    cartService = new CartService({ storage, eventBus });
  });

  describe('createCart', () => {
    it('should create a new empty cart', async () => {
      const cart = await cartService.createCart(cartId);
      expect(cart.id).toBe(cartId);
      expect(cart.items).toHaveLength(0);
      expect(cart.createdAt).toBeInstanceOf(Date);
      expect(cart.updatedAt).toBeInstanceOf(Date);
    });

    it('should create cart with metadata', async () => {
      const cart = await cartService.createCart(cartId, { userId: 'user-1', source: 'web' });
      expect(cart.metadata).toEqual({ userId: 'user-1', source: 'web' });
    });
  });

  describe('addItem', () => {
    it('should add first item to new cart', async () => {
      const cart = await cartService.addItem(cartId, {
        productId: 'prod-1',
        name: 'Test Product',
        price: 29.99,
        currency: 'USD',
        quantity: 2,
      });

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].productId).toBe('prod-1');
      expect(cart.items[0].quantity).toBe(2);
      expect(cart.items[0].price).toBe(29.99);
    });

    it('should increment quantity when adding existing product', async () => {
      await cartService.addItem(cartId, {
        productId: 'prod-1',
        name: 'Test Product',
        price: 29.99,
        currency: 'USD',
        quantity: 2,
      });

      const cart = await cartService.addItem(cartId, {
        productId: 'prod-1',
        name: 'Test Product',
        price: 29.99,
        currency: 'USD',
        quantity: 3,
      });

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(5);
    });

    it('should throw when quantity is zero or negative', async () => {
      await expect(
        cartService.addItem(cartId, {
          productId: 'prod-1',
          name: 'Test',
          price: 10,
          currency: 'USD',
          quantity: 0,
        })
      ).rejects.toThrow('Quantity must be greater than 0');

      await expect(
        cartService.addItem(cartId, {
          productId: 'prod-2',
          name: 'Test',
          price: 10,
          currency: 'USD',
          quantity: -1,
        })
      ).rejects.toThrow('Quantity must be greater than 0');
    });

    it('should throw when price is negative', async () => {
      await expect(
        cartService.addItem(cartId, {
          productId: 'prod-1',
          name: 'Test',
          price: -5,
          currency: 'USD',
          quantity: 1,
        })
      ).rejects.toThrow('Price cannot be negative');
    });

    it('should throw when name is empty', async () => {
      await expect(
        cartService.addItem(cartId, {
          productId: 'prod-1',
          name: '',
          price: 10,
          currency: 'USD',
          quantity: 1,
        })
      ).rejects.toThrow('Product name is required');
    });

    it('should respect maxItems limit', async () => {
      const limitedService = new CartService({
        storage: new InMemoryStorage(),
        maxItems: 2,
      });

      await limitedService.addItem(cartId, { productId: 'p1', name: 'P1', price: 10, currency: 'USD', quantity: 1 });
      await limitedService.addItem(cartId, { productId: 'p2', name: 'P2', price: 10, currency: 'USD', quantity: 1 });

      await expect(
        limitedService.addItem(cartId, { productId: 'p3', name: 'P3', price: 10, currency: 'USD', quantity: 1 })
      ).rejects.toThrow('Maximum number of items (2) reached');
    });
  });

  describe('updateItem', () => {
    beforeEach(async () => {
      await cartService.addItem(cartId, {
        productId: 'prod-1',
        name: 'Test Product',
        price: 29.99,
        currency: 'USD',
        quantity: 2,
      });
    });

    it('should update item quantity', async () => {
      const cart = await cartService.updateItem(cartId, {
        productId: 'prod-1',
        quantity: 5,
      });

      expect(cart.items[0].quantity).toBe(5);
    });

    it('should remove item when quantity is zero', async () => {
      const cart = await cartService.updateItem(cartId, {
        productId: 'prod-1',
        quantity: 0,
      });

      expect(cart.items).toHaveLength(0);
    });

    it('should throw for non-existent product', async () => {
      await expect(
        cartService.updateItem(cartId, { productId: 'non-existent', quantity: 1 })
      ).rejects.toThrow('Item with productId non-existent not found');
    });

    it('should throw for negative quantity', async () => {
      await expect(
        cartService.updateItem(cartId, { productId: 'prod-1', quantity: -1 })
      ).rejects.toThrow('Quantity cannot be negative');
    });

    it('should respect maxQuantityPerItem limit', async () => {
      const limitedService = new CartService({
        storage: new InMemoryStorage(),
        maxQuantityPerItem: 10,
      });
      await limitedService.addItem(cartId, { productId: 'p1', name: 'P1', price: 10, currency: 'USD', quantity: 1 });

      await expect(
        limitedService.updateItem(cartId, { productId: 'p1', quantity: 15 })
      ).rejects.toThrow('Maximum quantity per item (10) exceeded');
    });
  });

  describe('removeItem', () => {
    beforeEach(async () => {
      await cartService.addItem(cartId, {
        productId: 'prod-1',
        name: 'Test Product',
        price: 29.99,
        currency: 'USD',
        quantity: 2,
      });
    });

    it('should remove item from cart', async () => {
      const cart = await cartService.removeItem(cartId, 'prod-1');
      expect(cart.items).toHaveLength(0);
    });

    it('should throw for non-existent product', async () => {
      await expect(
        cartService.removeItem(cartId, 'non-existent')
      ).rejects.toThrow('Item with productId non-existent not found');
    });
  });

  describe('clearCart', () => {
    beforeEach(async () => {
      await cartService.addItem(cartId, { productId: 'p1', name: 'P1', price: 10, currency: 'USD', quantity: 1 });
      await cartService.addItem(cartId, { productId: 'p2', name: 'P2', price: 20, currency: 'USD', quantity: 2 });
    });

    it('should remove all items from cart', async () => {
      const cart = await cartService.clearCart(cartId);
      expect(cart.items).toHaveLength(0);
    });
  });

  describe('getSummary', () => {
    it('should calculate correct summary', async () => {
      await cartService.addItem(cartId, { productId: 'p1', name: 'P1', price: 10, currency: 'USD', quantity: 2 });
      await cartService.addItem(cartId, { productId: 'p2', name: 'P2', price: 20, currency: 'USD', quantity: 3 });

      const cart = await cartService.getCart(cartId);
      const summary = cartService.getSummary(cart!);

      expect(summary.itemCount).toBe(2);
      expect(summary.totalQuantity).toBe(5);
      expect(summary.subtotal).toBe(80); // 10*2 + 20*3
      expect(summary.currency).toBe('USD');
    });

    it('should return zero summary for empty cart', async () => {
      await cartService.createCart(cartId);
      const cart = await cartService.getCart(cartId);
      const summary = cartService.getSummary(cart!);

      expect(summary.itemCount).toBe(0);
      expect(summary.totalQuantity).toBe(0);
      expect(summary.subtotal).toBe(0);
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      await cartService.addItem(cartId, { productId: 'p1', name: 'P1', price: 10, currency: 'USD', quantity: 2 });
      await cartService.addItem(cartId, { productId: 'p2', name: 'P2', price: 20, currency: 'USD', quantity: 1 });
    });

    it('should check if item exists', async () => {
      const cart = await cartService.getCart(cartId);
      expect(cartService.hasItem(cart!, 'p1')).toBe(true);
      expect(cartService.hasItem(cart!, 'p3')).toBe(false);
    });

    it('should get item quantity', async () => {
      const cart = await cartService.getCart(cartId);
      expect(cartService.getItemQuantity(cart!, 'p1')).toBe(2);
      expect(cartService.getItemQuantity(cart!, 'p2')).toBe(1);
      expect(cartService.getItemQuantity(cart!, 'p3')).toBe(0);
    });

    it('should get items copy', async () => {
      const cart = await cartService.getCart(cartId);
      const items = cartService.getItems(cart!);
      expect(items).toHaveLength(2);
      items.push({} as any);
      expect(cartService.getItems(cart!)).toHaveLength(2);
    });
  });

  describe('events', () => {
    it('should emit events on cart operations', async () => {
      const events: string[] = [];
      eventBus.subscribe('item.added', () => { events.push('item.added'); });
      eventBus.subscribe('item.quantityChanged', () => { events.push('item.quantityChanged'); });
      eventBus.subscribe('item.removed', () => { events.push('item.removed'); });
      eventBus.subscribe('cart.updated', () => { events.push('cart.updated'); });
      eventBus.subscribe('cart.cleared', () => { events.push('cart.cleared'); });

      await cartService.addItem(cartId, { productId: 'p1', name: 'P1', price: 10, currency: 'USD', quantity: 1 });
      await cartService.updateItem(cartId, { productId: 'p1', quantity: 2 });
      await cartService.removeItem(cartId, 'p1');
      await cartService.addItem(cartId, { productId: 'p2', name: 'P2', price: 10, currency: 'USD', quantity: 1 });
      await cartService.clearCart(cartId);

      expect(events).toContain('item.added');
      expect(events).toContain('item.quantityChanged');
      expect(events).toContain('item.removed');
      expect(events).toContain('cart.updated');
      expect(events).toContain('cart.cleared');
    });

    it('should allow subscribing and unsubscribing', async () => {
      let count = 0;
      const handler = () => { count++; };

      eventBus.subscribe('item.added', handler);
      await cartService.addItem(cartId, { productId: 'p1', name: 'P1', price: 10, currency: 'USD', quantity: 1 });
      expect(count).toBe(1);

      eventBus.unsubscribe('item.added', handler);
      await cartService.addItem(cartId, { productId: 'p2', name: 'P2', price: 10, currency: 'USD', quantity: 1 });
      expect(count).toBe(1);
    });
  });

  describe('deleteCart', () => {
    it('should delete cart from storage', async () => {
      await cartService.addItem(cartId, { productId: 'p1', name: 'P1', price: 10, currency: 'USD', quantity: 1 });
      await cartService.deleteCart(cartId);
      const cart = await cartService.getCart(cartId);
      expect(cart).toBeNull();
    });
  });
});