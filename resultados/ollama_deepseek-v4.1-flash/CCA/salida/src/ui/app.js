import { products, findProduct } from '../data/catalog.js';
import { coupons } from '../data/coupons.js';
import { Cart } from '../core/Cart.js';
import { CheckoutService } from '../core/CheckoutService.js';
import { formatMoney } from '../core/money.js';
import { createDefaultPricing, shippingConfig } from '../config/pricing.js';
import { LocalStorageAdapter } from '../storage/LocalStorageAdapter.js';

const pricing = createDefaultPricing();
const storage = new LocalStorageAdapter();
const cart = new Cart({ storage, pricing });
const checkout = new CheckoutService();

const viewState = {
  category: 'Todos',
  search: '',
  sort: 'featured',
};

const categories = ['Todos', ...new Set(products.map((product) => product.category))];

const els = {
  grid: document.querySelector('#product-grid'),
  emptyCatalog: document.querySelector('#empty-catalog'),
  filters: document.querySelector('#category-filters'),
  search: document.querySelector('#search-input'),
  sort: document.querySelector('#sort-select'),
  cartToggle: document.querySelector('#cart-toggle'),
  cartBadge: document.querySelector('#cart-badge'),
  cartPanel: document.querySelector('#cart-panel'),
  cartOverlay: document.querySelector('#cart-overlay'),
  cartClose: document.querySelector('#cart-close'),
  cartSubtitle: document.querySelector('#cart-subtitle'),
  cartEmpty: document.querySelector('#cart-empty'),
  cartItems: document.querySelector('#cart-items'),
  cartFooter: document.querySelector('#cart-footer'),
  shippingMessage: document.querySelector('#shipping-message'),
  shippingBar: document.querySelector('#shipping-bar'),
  couponForm: document.querySelector('#coupon-form'),
  couponInput: document.querySelector('#coupon-input'),
  couponFeedback: document.querySelector('#coupon-feedback'),
  appliedCoupon: document.querySelector('#applied-coupon'),
  totals: document.querySelector('#totals'),
  checkoutButton: document.querySelector('#checkout-button'),
  toastContainer: document.querySelector('#toast-container'),
  orderDialog: document.querySelector('#order-dialog'),
  orderSummary: document.querySelector('#order-summary'),
  orderClose: document.querySelector('#order-close'),
  heroCta: document.querySelector('#hero-cta'),
  catalog: document.querySelector('.catalog'),
};

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

function getVisibleProducts() {
  const term = viewState.search.trim().toLowerCase();
  const visible = products.filter((product) => {
    const matchesCategory =
      viewState.category === 'Todos' || product.category === viewState.category;
    const haystack = `${product.name} ${product.description} ${product.category}`.toLowerCase();
    return matchesCategory && (!term || haystack.includes(term));
  });

  switch (viewState.sort) {
    case 'price-asc':
      return [...visible].sort((a, b) => a.priceCents - b.priceCents);
    case 'price-desc':
      return [...visible].sort((a, b) => b.priceCents - a.priceCents);
    case 'rating':
      return [...visible].sort((a, b) => b.rating - a.rating);
    default:
      return visible;
  }
}

function renderFilters() {
  els.filters.innerHTML = categories
    .map((category) => {
      const active = category === viewState.category;
      return `
        <button
          type="button"
          class="filter-button${active ? ' active' : ''}"
          data-category="${escapeHtml(category)}"
          aria-pressed="${active}"
        >${escapeHtml(category)}</button>
      `;
    })
    .join('');
}

function productCard(product, index) {
  const qty = cart.items.find((line) => line.product.id === product.id)?.qty ?? 0;
  return `
    <article
      class="product-card"
      data-product="${escapeHtml(product.id)}"
      style="animation-delay:${Math.min(index * 35, 350)}ms"
    >
      <div class="product-media" style="--accent:${escapeHtml(product.color)}">
        <span class="product-emoji" aria-hidden="true">${escapeHtml(product.image)}</span>
        ${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ''}
      </div>
      <div class="product-body">
        <div class="product-meta">
          <span>${escapeHtml(product.category)}</span>
          <span class="rating" aria-label="Valoración ${product.rating} sobre 5">★ ${product.rating.toFixed(1)}</span>
        </div>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="product-description">${escapeHtml(product.description)}</p>
        <div class="product-footer">
          <span class="product-price">${formatMoney(product.priceCents)}</span>
          <button
            type="button"
            class="add-button${qty ? ' in-cart' : ''}"
            data-add="${escapeHtml(product.id)}"
            aria-label="Añadir ${escapeHtml(product.name)} al carrito"
          >${qty ? `En carrito · ${qty}` : 'Añadir'}</button>
        </div>
      </div>
    </article>
  `;
}

function renderProducts() {
  const visible = getVisibleProducts();
  els.grid.innerHTML = visible.map(productCard).join('');
  els.emptyCatalog.hidden = visible.length > 0;
}

function syncProductButtons() {
  const quantities = new Map(cart.items.map((line) => [line.product.id, line.qty]));
  els.grid.querySelectorAll('[data-add]').forEach((button) => {
    const qty = quantities.get(button.dataset.add) ?? 0;
    button.classList.toggle('in-cart', qty > 0);
    button.textContent = qty > 0 ? `En carrito · ${qty}` : 'Añadir';
  });
}

function cartItemTemplate({ product, qty, lineTotalCents }) {
  return `
    <li class="cart-item" data-id="${escapeHtml(product.id)}">
      <div class="cart-item-media" style="--accent:${escapeHtml(product.color)}" aria-hidden="true">
        ${escapeHtml(product.image)}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-top">
          <h3>${escapeHtml(product.name)}</h3>
          <button
            type="button"
            class="remove-button"
            data-remove="${escapeHtml(product.id)}"
            aria-label="Eliminar ${escapeHtml(product.name)} del carrito"
          >✕</button>
        </div>
        <p class="cart-item-price">${formatMoney(product.priceCents)} · ${escapeHtml(product.category)}</p>
        <div class="cart-item-bottom">
          <div class="qty" role="group" aria-label="Cantidad de ${escapeHtml(product.name)}">
            <button type="button" data-decrement="${escapeHtml(product.id)}" aria-label="Quitar una unidad">−</button>
            <span aria-live="polite">${qty}</span>
            <button type="button" data-increment="${escapeHtml(product.id)}" aria-label="Añadir una unidad">+</button>
          </div>
          <span class="line-total">${formatMoney(lineTotalCents)}</span>
        </div>
      </div>
    </li>
  `;
}

function renderShipping(totals) {
  const threshold = totals.freeShippingThresholdCents ?? shippingConfig.freeThresholdCents;
  const remaining = totals.freeShippingRemainingCents ?? threshold;
  const progress =
    threshold > 0 ? Math.min(100, (totals.discountedSubtotalCents / threshold) * 100) : 100;

  els.shippingBar.style.width = `${progress}%`;
  els.shippingMessage.innerHTML = totals.freeShippingReached
    ? '<strong>¡Envío gratis conseguido!</strong>'
    : `Te faltan <strong>${formatMoney(remaining)}</strong> para el envío gratis`;
}

function renderCoupon(totals) {
  if (cart.coupon) {
    els.appliedCoupon.hidden = false;
    els.appliedCoupon.innerHTML = `
      <span>Cupón aplicado: ${escapeHtml(cart.coupon.code)}</span>
      <button type="button" data-remove-coupon>Quitar</button>
    `;
    els.couponForm.hidden = true;
    els.couponFeedback.hidden = true;
    return;
  }

  els.appliedCoupon.hidden = true;
  els.appliedCoupon.innerHTML = '';
  els.couponForm.hidden = false;

  if (totals.couponError) {
    showCouponFeedback(totals.couponError, 'error');
  } else {
    hideCouponFeedback();
  }
}

function renderTotals(totals) {
  const rows = [
    `<dt>Subtotal</dt><dd>${formatMoney(totals.subtotalCents)}</dd>`,
  ];

  for (const discount of totals.discounts) {
    rows.push(
      `<dt class="discount">${escapeHtml(discount.label)}</dt>` +
        `<dd class="discount">−${formatMoney(discount.amountCents)}</dd>`,
    );
  }

  const freeShipping = totals.shippingCents === 0;
  rows.push(
    `<dt>Envío</dt><dd class="${freeShipping ? 'free-shipping' : ''}">${
      freeShipping ? 'Gratis' : formatMoney(totals.shippingCents)
    }</dd>`,
  );
  rows.push(
    `<dt>${escapeHtml(totals.taxLabel ?? 'IVA')}</dt><dd>${formatMoney(totals.taxCents)}</dd>`,
  );
  rows.push(
    `<dt class="total-row">Total</dt><dd class="total-row">${formatMoney(totals.totalCents)}</dd>`,
  );

  els.totals.innerHTML = rows.join('');
}

function renderCart() {
  const items = cart.items;
  const totals = cart.totals();

  els.cartBadge.textContent = String(cart.count);
  els.cartBadge.hidden = cart.count === 0;
  els.cartSubtitle.textContent = cart.count === 1 ? '1 artículo' : `${cart.count} artículos`;

  els.cartEmpty.hidden = items.length > 0;
  els.cartItems.hidden = items.length === 0;
  els.cartFooter.hidden = items.length === 0;

  if (items.length === 0) {
    els.cartItems.innerHTML = '';
    return;
  }

  els.cartItems.innerHTML = items.map(cartItemTemplate).join('');
  renderShipping(totals);
  renderCoupon(totals);
  renderTotals(totals);
}

function showCouponFeedback(message, type = 'error') {
  els.couponFeedback.textContent = message;
  els.couponFeedback.classList.toggle('success', type === 'success');
  els.couponFeedback.hidden = false;
}

function hideCouponFeedback() {
  els.couponFeedback.hidden = true;
  els.couponFeedback.textContent = '';
  els.couponFeedback.classList.remove('success');
}

function toast(message) {
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  els.toastContainer.append(element);

  requestAnimationFrame(() => element.classList.add('toast-visible'));
  setTimeout(() => {
    element.classList.remove('toast-visible');
    setTimeout(() => element.remove(), 250);
  }, 2200);
}

let lastFocusedElement = null;

function openCart() {
  if (!els.cartPanel.hidden) {
    return;
  }
  lastFocusedElement = document.activeElement;
  els.cartOverlay.hidden = false;
  els.cartPanel.hidden = false;
  els.cartToggle.setAttribute('aria-expanded', 'true');
  document.body.classList.add('cart-open');
  els.cartClose.focus({ preventScroll: true });
}

function closeCart({ restoreFocus = true } = {}) {
  if (els.cartPanel.hidden) {
    return;
  }
  els.cartPanel.hidden = true;
  els.cartOverlay.hidden = true;
  els.cartToggle.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('cart-open');
  if (restoreFocus) {
    (lastFocusedElement ?? els.cartToggle).focus({ preventScroll: true });
  }
  lastFocusedElement = null;
}

function trapFocus(event) {
  if (event.key !== 'Tab' || els.cartPanel.hidden) {
    return;
  }

  const focusable = [
    ...els.cartPanel.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => element.offsetParent !== null || element === document.activeElement);

  if (focusable.length === 0) {
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function handleCouponSubmit(event) {
  event.preventDefault();
  const code = els.couponInput.value.trim().toUpperCase();

  if (!code) {
    showCouponFeedback('Introduce un código de descuento.', 'error');
    return;
  }

  const coupon = coupons.find((entry) => entry.code === code);
  if (!coupon) {
    showCouponFeedback('Ese código no es válido.', 'error');
    return;
  }

  const minimum = coupon.minSubtotalCents ?? 0;
  if (cart.totals().subtotalCents < minimum) {
    showCouponFeedback(
      `Este cupón requiere un mínimo de ${formatMoney(minimum)}.`,
      'error',
    );
    return;
  }

  cart.applyCoupon(coupon);
  els.couponInput.value = '';
  hideCouponFeedback();
  toast(`Cupón ${coupon.code} aplicado`);
}

function handleCheckout() {
  try {
    const order = checkout.process(cart, { customer: { source: 'web-demo' } });
    const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0);
    els.orderSummary.textContent =
      `Pedido ${order.id} · ${itemCount} ${itemCount === 1 ? 'artículo' : 'artículos'} · ` +
      `${formatMoney(order.totals.totalCents)}`;
    closeCart({ restoreFocus: false });
    els.orderDialog.showModal();
  } catch (error) {
    toast(error.message);
  }
}

function updateCart() {
  renderCart();
  syncProductButtons();
}

els.filters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) {
    return;
  }
  viewState.category = button.dataset.category;
  renderFilters();
  renderProducts();
});

els.search.addEventListener('input', () => {
  viewState.search = els.search.value;
  renderProducts();
});

els.sort.addEventListener('change', () => {
  viewState.sort = els.sort.value;
  renderProducts();
});

els.grid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-add]');
  if (!button) {
    return;
  }
  const product = findProduct(button.dataset.add);
  if (!product) {
    return;
  }
  cart.add(product);
  toast(`${product.name} añadido al carrito`);
});

els.cartToggle.addEventListener('click', openCart);
els.cartClose.addEventListener('click', () => closeCart());
els.cartOverlay.addEventListener('click', () => closeCart());
els.cartPanel.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-cart]')) {
    closeCart();
  }
  if (event.target.closest('[data-remove-coupon]')) {
    cart.removeCoupon();
    hideCouponFeedback();
    toast('Cupón eliminado');
  }
});

els.cartItems.addEventListener('click', (event) => {
  const decrement = event.target.closest('[data-decrement]');
  const increment = event.target.closest('[data-increment]');
  const remove = event.target.closest('[data-remove]');

  if (decrement) {
    cart.increment(decrement.dataset.decrement, -1);
  } else if (increment) {
    cart.increment(increment.dataset.increment, 1);
  } else if (remove) {
    cart.remove(remove.dataset.remove);
    toast('Producto eliminado');
  }
});

els.couponForm.addEventListener('submit', handleCouponSubmit);
els.checkoutButton.addEventListener('click', handleCheckout);

els.orderClose.addEventListener('click', () => {
  els.orderDialog.close();
  els.cartToggle.focus({ preventScroll: true });
});

els.heroCta.addEventListener('click', () => {
  els.catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !els.cartPanel.hidden) {
    closeCart();
  }
  trapFocus(event);
});

cart.on('change', updateCart);

renderFilters();
renderProducts();
renderCart();
