function defaultIdGenerator() {
  if (globalThis.crypto?.randomUUID) {
    return `ORD-${globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}

export class CheckoutService {
  constructor({ clock = () => new Date(), idGenerator = defaultIdGenerator } = {}) {
    this.clock = clock;
    this.idGenerator = idGenerator;
  }

  process(cart, { customer = {} } = {}) {
    if (!cart) {
      throw new Error('No se recibió un carrito');
    }
    if (cart.isEmpty) {
      throw new Error('El carrito está vacío');
    }

    const totals = cart.totals();
    if (!totals || totals.totalCents <= 0) {
      throw new Error('No se pudo calcular el total del pedido');
    }

    const order = {
      id: this.idGenerator(),
      createdAt: this.clock().toISOString(),
      status: 'confirmed',
      customer: { ...customer },
      items: cart.items.map(({ product, qty, lineTotalCents }) => ({
        productId: product.id,
        name: product.name,
        unitPriceCents: product.priceCents,
        qty,
        lineTotalCents,
      })),
      totals,
    };

    cart.clear();
    return order;
  }
}
