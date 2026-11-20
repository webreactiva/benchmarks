import { catalog, products, sampleItems } from './catalog.js';
import { applyCoupon, normalizeCart, quoteCart, readCart, serializeCart, setQuantity, storageKey } from './cart.js';
import { icon } from './icons.js';
import { cartView, checkoutView, collectionsView, confirmationView, itemLabel, shopView } from './views.js';

const root = document.querySelector('main');
const cartLink = document.querySelector('.header-cart');
const notification = document.querySelector('#notification');
const undoButton = notification.querySelector('button');
const dialog = document.querySelector('#checkout');
const pageSize = 6;

let store;
let cart = normalizeCart({ items: sampleItems }, catalog);
try {
  store = window.localStorage;
  cart = readCart(store.getItem(storageKey), catalog, { items: sampleItems });
} catch {
  store = undefined;
}

let activeRoute = getRoute();
let promoOpen = false;
let visibleProducts = pageSize;
let toastTimer;
let undo;
let review;

function getRoute() {
  const [page, category] = window.location.hash.slice(1).split('/');
  return { page: ['tienda', 'colecciones'].includes(page) ? page : 'carrito', category };
}

function render(focus) {
  const { page, category } = activeRoute;
  const quote = quoteCart(cart, catalog);

  root.innerHTML = page === 'tienda'
    ? shopView(cart, products, category, visibleProducts)
    : page === 'colecciones'
      ? collectionsView(catalog)
      : cartView(cart, quote, products, promoOpen);

  for (const link of document.querySelectorAll('.main-nav a, .header-cart')) {
    if (link.hash === '#' + page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  cartLink.querySelector('.cart-count').textContent = quote.count;
  cartLink.setAttribute('aria-label', `Carrito, ${quote.count} ${itemLabel(quote.count)}`);
  document.title = root.querySelector('h1').textContent.replace(/\.$/, '') + ' · Savia';

  if (focus?.action) {
    const buttons = Array.from(root.querySelectorAll('button[data-action]:not(:disabled)'));
    const matching = buttons.find(button => button.dataset.id === focus.id && button.dataset.action === focus.action);
    const sameProduct = focus.id && buttons.find(button => button.dataset.id === focus.id);
    const nextTarget = matching || sameProduct || root.querySelector(focus.fallback ?? '#page-title') || root.querySelector('#page-title');
    nextTarget?.focus({ preventScroll: true });
  }
}

function updateCart(next, focus) {
  if (next === cart) return;
  cart = next;
  try {
    store?.setItem(storageKey, serializeCart(cart));
  } catch {
    store = undefined;
  }
  render(focus);
}

function showNotice(message, restore) {
  clearTimeout(toastTimer);
  undo = restore;
  notification.hidden = false;
  notification.querySelector('p').textContent = message;
  undoButton.hidden = !restore;
  toastTimer = setTimeout(() => {
    if (notification.contains(document.activeElement)) root.querySelector('#page-title').focus({ preventScroll: true });
    notification.hidden = true;
    undo = undefined;
  }, 5500);
}

for (const element of document.querySelectorAll('[data-icon]')) {
  element.innerHTML = icon(element.dataset.icon);
}

window.addEventListener('hashchange', () => {
  const next = getRoute();
  if (next.page === activeRoute.page && next.category === activeRoute.category) return;
  activeRoute = next;
  visibleProducts = pageSize;
  promoOpen = false;
  render();
  window.scrollTo(0, 0);
  root.querySelector('#page-title').focus({ preventScroll: true });
});

window.addEventListener('storage', event => {
  if (!store || event.storageArea !== store || (event.key !== storageKey && event.key !== null)) return;
  cart = readCart(event.newValue, catalog);
  render();
  if (dialog.open && review) {
    dialog.close();
    showNotice('Tu carrito se actualizó en otra pestaña.');
  }
});

root.addEventListener('toggle', event => {
  if (event.target.matches('.promo') && root.contains(event.target)) promoOpen = event.target.open;
}, true);

root.addEventListener('submit', event => {
  if (event.target.id !== 'promo-form') return;
  event.preventDefault();
  const input = event.target.elements.code;
  const next = applyCoupon(cart, input.value);
  if (!next) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', 'promo-feedback');
    document.querySelector('#promo-feedback').textContent = 'El código introducido no es válido.';
    input.focus();
    return;
  }
  updateCart(next, { action: 'remove-coupon' });
  showNotice('Código promocional aplicado.');
});

document.addEventListener('click', event => {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const { action, id } = control.dataset;
  const product = catalog.get(id);
  const quantity = cart.items.get(id) ?? 0;

  switch (action) {
    case 'add':
    case 'increase':
    case 'decrease': {
      const next = setQuantity(cart, catalog, id, quantity + (action === 'decrease' ? -1 : 1));
      updateCart(next, { action, id, fallback: '.card-add:not(:disabled)' });
      if (action === 'add') showNotice(`${product.name} añadido al carrito.`);
      break;
    }
    case 'remove': {
      const coupon = cart.items.size === 1 ? cart.coupon : '';
      updateCart(setQuantity(cart, catalog, id, 0), { action, id, fallback: '.remove-button' });
      showNotice(`${product.name} eliminado del carrito.`, { id, quantity, coupon });
      break;
    }
    case 'undo':
      if (undo) {
        const restored = catalog.get(undo.id);
        const current = cart.items.get(undo.id) ?? 0;
        const next = setQuantity(cart, catalog, undo.id, current + undo.quantity);
        const restoredCart = undo.coupon && !next.coupon ? applyCoupon(next, undo.coupon) : next;
        updateCart(restoredCart ?? next, { action: 'remove', id: undo.id });
        showNotice(`${restored.name} recuperado.`);
      }
      break;
    case 'remove-coupon':
      updateCart({ ...cart, coupon: '' }, { action, fallback: '#promo-code' });
      showNotice('Código promocional retirado.');
      break;
    case 'more': {
      const index = visibleProducts;
      visibleProducts += pageSize;
      render();
      root.querySelectorAll('.card-add:not(.more-button)')[index]?.focus();
      break;
    }
    case 'checkout': {
      const quote = quoteCart(cart, catalog);
      if (!quote.count || dialog.open) break;
      review = cart;
      dialog.innerHTML = checkoutView(quote);
      dialog.showModal();
      dialog.querySelector('.dialog-close').focus();
      break;
    }
    case 'confirm':
      if (review !== cart || !dialog.open) break;
      review = undefined;
      undo = undefined;
      notification.hidden = true;
      updateCart(normalizeCart({}, catalog));
      dialog.innerHTML = confirmationView();
      dialog.querySelector('.dialog-close').focus();
      break;
    case 'close-dialog':
      dialog.close();
      break;
  }
});

dialog.addEventListener('close', () => {
  if (dialog.open) return;
  review = undefined;
  if (!document.activeElement.closest('main, .site-header')) root.querySelector('#page-title').focus({ preventScroll: true });
});

render();
