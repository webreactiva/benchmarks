/* UI de demostración: JS a secas, sin build ni dependencias de frontend. */

const $ = (selector) => document.querySelector(selector);

const els = {
  grid: $('#product-grid'),
  panel: $('#cart-panel'),
  count: $('#cart-count'),
  toggle: $('#cart-toggle'),
  toast: $('#toast'),
};

const CART_KEY = 'tiendadev:cart-id';

const state = { products: [], cart: null };

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const fmt = (cents) => eur.format(cents / 100);

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

/* ---------- API ---------- */

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const err = new Error(payload?.error?.message ?? `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

async function ensureCart() {
  const savedId = localStorage.getItem(CART_KEY);
  if (savedId) {
    try {
      state.cart = await api(`/api/carts/${savedId}`);
      return;
    } catch (err) {
      if (err.status !== 404) throw err; // carrito caducado → se crea uno nuevo
    }
  }
  state.cart = await api('/api/carts', { method: 'POST' });
  localStorage.setItem(CART_KEY, state.cart.id);
}

async function refreshProducts() {
  const { products } = await api('/api/products');
  state.products = products;
  renderProducts();
}

/* ---------- Render ---------- */

function renderProducts() {
  els.grid.innerHTML = state.products
    .map(
      (p) => `
      <article class="product">
        <div class="product-emoji">${esc(p.emoji)}</div>
        <h3 class="product-name">${esc(p.name)}</h3>
        <p class="product-desc">${esc(p.description)}</p>
        <div class="product-foot">
          <div>
            <div class="price">${fmt(p.priceCents)}</div>
            <div class="stock ${p.stock === 0 ? 'out' : ''}">
              ${p.stock === 0 ? 'Sin stock' : `${p.stock} uds.`}
            </div>
          </div>
          <button class="btn" data-add="${esc(p.id)}" ${p.stock === 0 ? 'disabled' : ''}>Añadir</button>
        </div>
      </article>`,
    )
    .join('');
}

function renderCart() {
  const cart = state.cart;
  if (!cart) return;

  els.count.textContent = String(cart.itemCount);
  els.count.hidden = cart.itemCount === 0;

  const s = cart.summary;

  const itemsHtml =
    cart.items.length === 0
      ? '<p class="cart-empty">Tu carrito está vacío.</p>'
      : cart.items
          .map(
            (i) => `
        <div class="cart-item">
          <div class="cart-item-emoji">${esc(i.emoji)}</div>
          <div>
            <div class="cart-item-name">${esc(i.name)}</div>
            <div class="cart-item-unit">${fmt(i.unitPriceCents)} / ud.</div>
            <div class="stepper">
              <button data-dec="${esc(i.productId)}" aria-label="Restar una unidad">−</button>
              <span class="qty">${i.quantity}</span>
              <button data-inc="${esc(i.productId)}" aria-label="Sumar una unidad"
                ${i.quantity >= i.stock ? 'disabled title="Sin más stock"' : ''}>+</button>
            </div>
          </div>
          <div style="text-align: right">
            <div class="line-total">${fmt(i.lineTotalCents)}</div>
            <button class="remove" data-remove="${esc(i.productId)}" aria-label="Eliminar línea">🗑️</button>
          </div>
        </div>`,
          )
          .join('');

  const discountHtml = s.discountCode
    ? `<div class="discount-applied">
         <span>✅ ${esc(s.discountCode)}</span>
         <button class="btn ghost small" data-remove-discount>Quitar</button>
       </div>`
    : `<form class="discount-form" id="discount-form">
         <input name="code" placeholder="Código promocional" autocomplete="off" required />
         <button class="btn secondary" type="submit">Aplicar</button>
       </form>`;

  els.panel.innerHTML = `
    <h2 class="cart-title">
      🧺 Tu carrito
      <button class="cart-close" id="cart-close" aria-label="Cerrar carrito">✕</button>
    </h2>
    ${itemsHtml}
    ${discountHtml}
    <div class="summary">
      <div class="summary-row"><span>Subtotal</span><span>${fmt(s.subtotalCents)}</span></div>
      ${s.discountCents > 0 ? `<div class="summary-row discount"><span>Descuento ${esc(s.discountCode ?? '')}</span><span>−${fmt(s.discountCents)}</span></div>` : ''}
      <div class="summary-row"><span>Envío</span><span>${s.shippingCents === 0 ? 'Gratis' : fmt(s.shippingCents)}</span></div>
      <div class="summary-row"><span>IVA (${Math.round(s.taxRate * 100)} %)</span><span>${fmt(s.taxCents)}</span></div>
      <div class="summary-row total"><span>Total</span><span>${fmt(s.totalCents)}</span></div>
    </div>
    <button class="btn" id="checkout" ${cart.items.length === 0 ? 'disabled' : ''}>Tramitar pedido</button>
  `;
}

/* ---------- Avisos ---------- */

let toastTimer;

function toast(message, { error = false } = {}) {
  els.toast.textContent = message;
  els.toast.classList.toggle('error', error);
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 3200);
}

/* ---------- Acciones ---------- */

async function call(fn, okMessage) {
  try {
    state.cart = await fn();
    renderCart();
    if (okMessage) toast(okMessage);
  } catch (err) {
    toast(err.message, { error: true });
  }
}

async function doCheckout() {
  try {
    const { order, cart } = await api(`/api/carts/${state.cart.id}/checkout`, { method: 'POST' });
    state.cart = cart;
    toast(`✅ Pedido ${order.id} confirmado — Total ${fmt(order.totalCents)}`);
    await refreshProducts(); // el stock ha cambiado
    renderCart();
  } catch (err) {
    toast(err.message, { error: true });
  }
}

/* ---------- Eventos (delegación) ---------- */

els.grid.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  btn.disabled = true;
  await call(
    () =>
      api(`/api/carts/${state.cart.id}/items`, {
        method: 'POST',
        body: { productId: btn.dataset.add, quantity: 1 },
      }),
    'Producto añadido al carrito',
  );
  btn.disabled = false;
});

els.panel.addEventListener('click', async (e) => {
  if (e.target.closest('#cart-close')) {
    els.panel.classList.remove('open');
    return;
  }
  if (e.target.closest('[data-remove-discount]')) {
    await call(() => api(`/api/carts/${state.cart.id}/discount`, { method: 'DELETE' }));
    return;
  }
  if (e.target.closest('#checkout')) {
    await doCheckout();
    return;
  }

  const item = (id) => state.cart.items.find((i) => i.productId === id);

  const inc = e.target.closest('[data-inc]');
  if (inc) {
    const current = item(inc.dataset.inc);
    await call(() =>
      api(`/api/carts/${state.cart.id}/items/${inc.dataset.inc}`, {
        method: 'PATCH',
        body: { quantity: current.quantity + 1 },
      }),
    );
    return;
  }

  const dec = e.target.closest('[data-dec]');
  if (dec) {
    const current = item(dec.dataset.dec);
    await call(() =>
      current.quantity === 1
        ? api(`/api/carts/${state.cart.id}/items/${dec.dataset.dec}`, { method: 'DELETE' })
        : api(`/api/carts/${state.cart.id}/items/${dec.dataset.dec}`, {
            method: 'PATCH',
            body: { quantity: current.quantity - 1 },
          }),
    );
    return;
  }

  const rem = e.target.closest('[data-remove]');
  if (rem) {
    await call(() =>
      api(`/api/carts/${state.cart.id}/items/${rem.dataset.remove}`, { method: 'DELETE' }),
    );
  }
});

els.panel.addEventListener('submit', async (e) => {
  if (e.target.id !== 'discount-form') return;
  e.preventDefault();
  const code = new FormData(e.target).get('code').trim();
  if (!code) return;
  await call(
    () => api(`/api/carts/${state.cart.id}/discount`, { method: 'POST', body: { code } }),
    'Código aplicado',
  );
});

els.toggle.addEventListener('click', () => {
  if (window.matchMedia('(max-width: 900px)').matches) {
    els.panel.classList.toggle('open');
  } else {
    els.panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

/* ---------- Arranque ---------- */

(async () => {
  try {
    await refreshProducts();
    await ensureCart();
    renderCart();
  } catch (err) {
    toast(err.message, { error: true });
  }
})();
