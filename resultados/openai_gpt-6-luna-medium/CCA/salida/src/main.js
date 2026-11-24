import { categories, formatPrice, products } from './products.js';
import { CartStore } from './cart-store.js';

const store = new CartStore(products);
const $ = (selector) => document.querySelector(selector);
const grid = $('#product-grid');
const categoryList = $('#categories');
const searchInput = $('#search-input');
const cartDrawer = $('#cart-drawer');
const overlay = $('#overlay');
let activeCategory = 'Todo';
let sortMode = 0;
let latestCart = store.snapshot();
let toastTimer;

function renderCategories() {
  categoryList.innerHTML = categories.map((category) => `<button class="category-chip ${category === activeCategory ? 'active' : ''}" data-category="${category}" aria-pressed="${category === activeCategory}">${category}</button>`).join('');
}

function filteredProducts() {
  const query = searchInput.value.trim().toLocaleLowerCase('es');
  let result = products.filter((product) => (activeCategory === 'Todo' || product.category === activeCategory) && (!query || `${product.name} ${product.detail} ${product.category}`.toLocaleLowerCase('es').includes(query)));
  if (sortMode === 1) result = [...result].sort((a, b) => a.price - b.price);
  if (sortMode === 2) result = [...result].sort((a, b) => b.price - a.price);
  return result;
}

function renderProducts() {
  const visible = filteredProducts();
  $('#result-count').textContent = `${visible.length} ${visible.length === 1 ? 'objeto' : 'objetos'}`;
  grid.innerHTML = visible.length ? visible.map((product) => `<article class="product-card">
    <div class="product-visual"><img src="${product.image}" alt="${product.imageAlt}" loading="lazy" />${product.tag ? `<span class="product-tag">${product.tag}</span>` : ''}<button class="quick-add" data-add="${product.id}" aria-label="Añadir ${product.name} al carrito">+</button></div>
    <div class="product-meta"><div><h3 class="product-name">${product.name}</h3><p class="product-detail">${product.detail}</p></div><span class="product-price">${formatPrice(product.price)}</span></div>
  </article>`).join('') : '<div class="empty-results">No encontramos objetos con esa búsqueda. Prueba con otra palabra.</div>';
}

function renderCart(state) {
  latestCart = state;
  $('#cart-count').textContent = state.count;
  $('#drawer-count').textContent = `(${state.count})`;
  const left = Math.max(0, 80 - state.subtotal);
  $('#shipping-progress').innerHTML = state.subtotal >= 80
    ? '<strong>¡Envío gratis desbloqueado!</strong><div class="progress-track"><span style="width:100%"></span></div>'
    : `Te faltan <strong>${formatPrice(left)}</strong> para el envío gratis<div class="progress-track"><span style="width:${Math.min(100, state.subtotal / 80 * 100)}%"></span></div>`;
  if (!state.items.length) {
    $('#cart-items').innerHTML = '<div class="cart-empty"><span class="empty-mark">n</span><h3>Tu carrito está tranquilo.</h3><p>Cuando encuentres algo que te guste, estará aquí.</p><button class="text-link" data-close>Seguir explorando</button></div>';
    $('#drawer-footer').innerHTML = '';
    return;
  }
  $('#cart-items').innerHTML = state.items.map(({ product, quantity }) => `<div class="cart-item">
    <img src="${product.image}" alt="${product.imageAlt}" />
    <div class="cart-item-info"><p class="cart-item-name">${product.name}</p><p class="cart-item-variant">${product.detail}</p><div class="qty-control" aria-label="Cantidad de ${product.name}"><button data-qty="${product.id}" data-delta="-1" aria-label="Quitar una unidad">−</button><span>${quantity}</span><button data-qty="${product.id}" data-delta="1" aria-label="Añadir una unidad">+</button></div><button class="remove-item" data-remove="${product.id}">Eliminar</button></div>
    <span class="cart-item-price">${formatPrice(product.price * quantity)}</span>
  </div>`).join('');
  $('#drawer-footer').innerHTML = `<div class="subtotal-row"><span>Subtotal</span><span>${formatPrice(state.subtotal)}</span></div><p class="shipping-caption">${state.subtotal >= 80 ? 'Envío gratis incluido.' : 'Envío calculado al finalizar la compra.'}</p><button class="checkout-button" id="checkout-button"><span>Continuar al pago</span><span>→</span></button><p class="secure-note">Pago seguro · Cambios sencillos durante 30 días</p>`;
}

function openCart() {
  overlay.hidden = false;
  requestAnimationFrame(() => { overlay.classList.add('visible'); cartDrawer.classList.add('open'); });
  cartDrawer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  $('#close-cart').focus();
}

function closeCart() {
  overlay.classList.remove('visible');
  cartDrawer.classList.remove('open');
  cartDrawer.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  window.setTimeout(() => { if (!cartDrawer.classList.contains('open')) overlay.hidden = true; }, 250);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 1900);
}

categoryList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category;
  renderCategories(); renderProducts();
});
searchInput.addEventListener('input', renderProducts);
$('.search-toggle').addEventListener('click', () => { searchInput.focus(); $('#productos').scrollIntoView({ behavior: 'smooth' }); });
$('#sort-button').addEventListener('click', () => {
  sortMode = (sortMode + 1) % 3;
  const labels = ['Destacados', 'Precio: menor a mayor', 'Precio: mayor a menor'];
  $('#sort-button').innerHTML = `Ordenar: <strong>${labels[sortMode]}</strong><span>⌄</span>`;
  renderProducts();
});
grid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-add]');
  if (!button) return;
  store.add(button.dataset.add);
  const product = products.find(({ id }) => id === button.dataset.add);
  showToast(`${product.name} añadido al carrito`);
});
$('#open-cart').addEventListener('click', openCart);
$('#close-cart').addEventListener('click', closeCart);
overlay.addEventListener('click', closeCart);
$('#cart-items').addEventListener('click', (event) => {
  const quantityButton = event.target.closest('[data-qty]');
  const removeButton = event.target.closest('[data-remove]');
  if (quantityButton) {
    const current = latestCart.items.find(({ product }) => product.id === quantityButton.dataset.qty)?.quantity || 0;
    store.setQuantity(quantityButton.dataset.qty, current + Number(quantityButton.dataset.delta));
  }
  if (removeButton) store.remove(removeButton.dataset.remove);
  if (event.target.closest('[data-close]')) closeCart();
});
$('#drawer-footer').addEventListener('click', (event) => {
  if (event.target.closest('#checkout-button')) showToast('El pago estará disponible próximamente');
});
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && cartDrawer.classList.contains('open')) closeCart(); });
store.subscribe(renderCart);
renderCategories();
renderProducts();
