export const shipping = { freeFrom: 7500, standard: 495 };
const coupons = new Map([['SAVIA10', 10]]);
export const storageKey = 'savia.cart';
const storageVersion = 1;

export function normalizeCart(saved, catalog) {
  const items = new Map();

  for (const [id, quantity] of Object.entries(saved?.items ?? {})) {
    const stock = catalog.get(id)?.stock ?? 0;
    if (Number.isSafeInteger(quantity) && quantity > 0 && stock > 0) {
      items.set(id, Math.min(quantity, stock));
    }
  }

  const coupon = coupons.has(saved?.coupon) ? saved.coupon : '';
  return { items, coupon: items.size ? coupon : '' };
}

export function readCart(serialized, catalog, fallback = {}) {
  if (serialized == null) return normalizeCart(fallback, catalog);
  try {
    const saved = JSON.parse(serialized);
    return normalizeCart(saved?.version === storageVersion ? saved : fallback, catalog);
  } catch {
    return normalizeCart(fallback, catalog);
  }
}

export function serializeCart(cart) {
  return JSON.stringify({ version: storageVersion, items: Object.fromEntries(cart.items), coupon: cart.coupon });
}

export function setQuantity(cart, catalog, id, quantity) {
  const product = catalog.get(id);
  if (!product || !Number.isSafeInteger(quantity)) return cart;
  const nextQuantity = Math.max(0, Math.min(quantity, product.stock));
  if (nextQuantity === (cart.items.get(id) ?? 0)) return cart;

  const items = new Map(cart.items);
  if (nextQuantity > 0) items.set(id, nextQuantity);
  else items.delete(id);

  return { items, coupon: items.size ? cart.coupon : '' };
}

export function applyCoupon(cart, input) {
  const coupon = input.trim().toUpperCase();
  if (cart.items.size === 0 || !coupons.has(coupon)) return null;
  return { ...cart, coupon };
}

export function quoteCart(cart, catalog) {
  let count = 0;
  let subtotal = 0;
  const lines = [];

  for (const [id, quantity] of cart.items) {
    const product = catalog.get(id);
    const total = product.price * quantity;
    lines.push({ product, quantity, total });
    subtotal += total;
    count += quantity;
  }

  const discount = Math.round(subtotal * (coupons.get(cart.coupon) ?? 0) / 100);
  const remaining = Math.max(0, shipping.freeFrom - subtotal);
  const delivery = count > 0 && remaining > 0 ? shipping.standard : 0;
  return { lines, count, subtotal, discount, remaining, delivery, total: subtotal - discount + delivery };
}
