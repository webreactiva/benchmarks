import { randomUUID } from 'node:crypto';
import { MAX_QTY_PER_ITEM, type Cart, type CartItemView, type CartView } from '../domain/cart.js';
import type { Product } from '../domain/product.js';
import {
  CartItemNotFoundError,
  CartNotFoundError,
  DiscountMinSubtotalError,
  EmptyCartError,
  InvalidDiscountCodeError,
  InvalidQuantityError,
  OutOfStockError,
  ProductNotFoundError,
} from '../domain/errors.js';
import type { CartRepository, ProductRepository } from '../ports/repositories.js';
import type { PricingService } from './pricing-service.js';

export interface CheckoutResult {
  order: {
    id: string;
    createdAt: string;
    itemCount: number;
    totalCents: number;
  };
  /** El carrito, ya vacío, para seguir comprando. */
  cart: CartView;
}

/**
 * Casos de uso del carrito. No sabe nada de HTTP ni de SQL: solo dominio,
 * puertos y pricing. Se prueba entero con repositorios en memoria (tests/).
 */
export class CartService {
  constructor(
    private readonly carts: CartRepository,
    private readonly products: ProductRepository,
    private readonly pricing: PricingService,
  ) {}

  async createCart(): Promise<CartView> {
    const now = new Date().toISOString();
    const cart: Cart = {
      id: `c_${randomUUID()}`,
      items: [],
      discountCode: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.carts.create(cart);
    return this.buildView(cart);
  }

  async getCart(cartId: string): Promise<CartView> {
    return this.buildView(await this.mustGetCart(cartId));
  }

  /** Añade `quantity` unidades; si el producto ya está, las suma a la línea. */
  async addItem(cartId: string, productId: string, quantity: number): Promise<CartView> {
    this.assertQuantity(quantity);
    const cart = await this.mustGetCart(cartId);
    const product = await this.mustGetProduct(productId);
    const current = cart.items.find((item) => item.productId === productId)?.quantity ?? 0;
    const target = current + quantity;
    const limit = Math.min(product.stock, MAX_QTY_PER_ITEM);
    if (target > limit) {
      throw new OutOfStockError(product.id, target, limit);
    }
    return this.upsertAndSave(cart, productId, target);
  }

  /** Fija la cantidad de una línea. `quantity = 0` elimina la línea. */
  async setQuantity(cartId: string, productId: string, quantity: number): Promise<CartView> {
    if (quantity === 0) return this.removeItem(cartId, productId);
    this.assertQuantity(quantity);
    const cart = await this.mustGetCart(cartId);
    if (!cart.items.some((item) => item.productId === productId)) {
      throw new CartItemNotFoundError(productId);
    }
    const product = await this.mustGetProduct(productId);
    if (quantity > product.stock) {
      throw new OutOfStockError(product.id, quantity, product.stock);
    }
    return this.upsertAndSave(cart, productId, quantity);
  }

  async removeItem(cartId: string, productId: string): Promise<CartView> {
    const cart = await this.mustGetCart(cartId);
    const before = cart.items.length;
    cart.items = cart.items.filter((item) => item.productId !== productId);
    if (cart.items.length === before) throw new CartItemNotFoundError(productId);
    return this.save(cart);
  }

  /** Vacía el carrito manteniendo su identidad (el cliente puede seguir comprando). */
  async clearCart(cartId: string): Promise<CartView> {
    const cart = await this.mustGetCart(cartId);
    cart.items = [];
    return this.save(cart);
  }

  async applyDiscount(cartId: string, code: string): Promise<CartView> {
    const cart = await this.mustGetCart(cartId);
    const rule = this.pricing.findDiscount(code);
    if (!rule) throw new InvalidDiscountCodeError(code);
    const { subtotalCents } = (await this.buildView(cart)).summary;
    const min = rule.minSubtotalCents ?? 0;
    if (subtotalCents < min) throw new DiscountMinSubtotalError(rule.code, min, subtotalCents);
    cart.discountCode = rule.code;
    return this.save(cart);
  }

  async removeDiscount(cartId: string): Promise<CartView> {
    const cart = await this.mustGetCart(cartId);
    cart.discountCode = null;
    return this.save(cart);
  }

  /**
   * Checkout: re-valida el stock, lo descuenta, vacía el carrito y devuelve el
   * resumen del pedido. Si algo falla a mitad de camino, compensa los descuentos
   * ya aplicados (el siguiente paso natural sería una unidad de trabajo /
   * transacción: ver README → "Cómo extender").
   */
  async checkout(cartId: string): Promise<CheckoutResult> {
    const cart = await this.mustGetCart(cartId);
    if (cart.items.length === 0) throw new EmptyCartError();

    const snapshot = await this.buildView(cart);

    const decremented: { productId: string; quantity: number }[] = [];
    for (const item of cart.items) {
      const ok = await this.products.adjustStock(item.productId, -item.quantity);
      if (!ok) {
        for (const done of decremented) {
          await this.products.adjustStock(done.productId, done.quantity);
        }
        const product = await this.products.findById(item.productId);
        if (!product) throw new ProductNotFoundError(item.productId);
        throw new OutOfStockError(product.id, item.quantity, product.stock);
      }
      decremented.push(item);
    }

    cart.items = [];
    cart.discountCode = null;
    const view = await this.save(cart);

    return {
      order: {
        id: `o_${randomUUID()}`,
        createdAt: new Date().toISOString(),
        itemCount: snapshot.itemCount,
        totalCents: snapshot.summary.totalCents,
      },
      cart: view,
    };
  }

  private assertQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_ITEM) {
      throw new InvalidQuantityError(quantity, MAX_QTY_PER_ITEM);
    }
  }

  private async mustGetCart(cartId: string): Promise<Cart> {
    const cart = await this.carts.findById(cartId);
    if (!cart) throw new CartNotFoundError(cartId);
    return cart;
  }

  private async mustGetProduct(productId: string): Promise<Product> {
    const product = await this.products.findById(productId);
    if (!product) throw new ProductNotFoundError(productId);
    return product;
  }

  private async upsertAndSave(
    cart: Cart,
    productId: string,
    quantity: number,
  ): Promise<CartView> {
    const existing = cart.items.find((item) => item.productId === productId);
    if (existing) {
      existing.quantity = quantity;
    } else {
      cart.items.push({ productId, quantity });
    }
    return this.save(cart);
  }

  private async save(cart: Cart): Promise<CartView> {
    cart.updatedAt = new Date().toISOString();
    await this.carts.save(cart);
    return this.buildView(cart);
  }

  /**
   * Enriquece las líneas con datos del catálogo y calcula el desglose.
   * Los precios SIEMPRE son los vigentes; el carrito no almacena precios.
   */
  private async buildView(cart: Cart): Promise<CartView> {
    const items: CartItemView[] = [];
    for (const item of cart.items) {
      const product = await this.products.findById(item.productId);
      if (!product) continue; // producto retirado del catálogo: no se muestra
      items.push({
        productId: product.id,
        name: product.name,
        emoji: product.emoji,
        unitPriceCents: product.priceCents,
        quantity: item.quantity,
        lineTotalCents: product.priceCents * item.quantity,
        stock: product.stock,
      });
    }
    const summary = this.pricing.price(items, cart.discountCode);
    return {
      id: cart.id,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      items,
      summary,
    };
  }
}
