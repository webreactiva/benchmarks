import { categories } from './catalog.js';
import { shipping } from './cart.js';
import { icon } from './icons.js';

const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
export const money = cents => currency.format(cents / 100);
export const itemLabel = count => count === 1 ? 'artículo' : 'artículos';

function photo(product, className = '', lazy = true) {
  return `<img class="product-photo ${className}" src="/assets/${product.id}.webp" alt="" width="448" height="448" ${lazy ? 'loading="lazy"' : ''}>`;
}

function intro(title, copy, current) {
  return `<section class="intro" aria-labelledby="page-title">
    <nav class="breadcrumb" aria-label="Ruta de navegación">
      <a href="#tienda">Inicio</a>${icon('chevron')}<span aria-current="page">${current}</span>
    </nav>
    <h1 id="page-title" tabindex="-1">${title}<span>.</span></h1>
    <p>${copy}</p>
  </section>`;
}

function cartLine({ product, quantity, total }) {
  return `<li class="cart-row">
    <div class="cart-product">
      ${photo(product, 'cart-photo', false)}
      <div>
        <h3>${product.name}</h3>
        <p>${product.detail}</p>
        <span class="unit-price">${money(product.price)}</span>
      </div>
    </div>
    <div class="stepper" role="group" aria-label="Cantidad de ${product.name}">
      <button type="button" data-action="decrease" data-id="${product.id}" aria-label="Reducir cantidad de ${product.name}" ${quantity === 1 ? 'disabled' : ''}>${icon('minus')}</button>
      <span aria-label="${quantity} unidades">${quantity}</span>
      <button type="button" data-action="increase" data-id="${product.id}" aria-label="Aumentar cantidad de ${product.name}" ${quantity >= product.stock ? 'disabled' : ''}>${icon('plus')}</button>
    </div>
    <strong class="line-total">${money(total)}</strong>
    <button type="button" class="remove-button" data-action="remove" data-id="${product.id}" aria-label="Quitar ${product.name}">${icon('trash')}</button>
  </li>`;
}

function summary(quote, coupon, promoOpen) {
  const progress = Math.min(quote.subtotal, shipping.freeFrom);
  return `<aside class="summary" aria-labelledby="summary-title">
    <h2 id="summary-title">Resumen del pedido</h2>
    <dl class="totals">
      <div><dt>Subtotal</dt><dd>${money(quote.subtotal)}</dd></div>
      ${coupon ? `<div class="discount"><dt>Descuento</dt><dd>−${money(quote.discount)}</dd></div>` : ''}
      <div><dt>Envío</dt><dd>${quote.delivery ? money(quote.delivery) : 'Gratis'}</dd></div>
    </dl>
    <details class="promo" ${promoOpen || coupon ? 'open' : ''}>
      <summary>Código promocional ${icon('chevron-down')}</summary>
      ${coupon
        ? `<div class="applied-code"><span>${icon('check')} ${coupon} aplicado</span><button class="text-button" data-action="remove-coupon">Quitar</button></div>`
        : `<form id="promo-form"><label class="sr-only" for="promo-code">Código promocional</label>
          <div class="code-field"><input id="promo-code" name="code" placeholder="Introduce el código" maxlength="40" required><button type="submit">Aplicar</button></div>
          <p id="promo-feedback" aria-live="polite"></p></form>`}
    </details>
    <div class="grand-total"><span>Total <small>IVA incluido</small></span><strong>${money(quote.total)}</strong></div>
    <button class="button primary checkout-button" type="button" data-action="checkout">Finalizar compra ${icon('arrow-right')}</button>
    <div class="shipping-meter">
      <div>${icon('truck')}<p>${quote.remaining ? `Te faltan <strong>${money(quote.remaining)}</strong> para el envío gratis` : '<strong>Envío gratis en este pedido</strong>'}</p></div>
      <progress value="${progress}" max="${shipping.freeFrom}" aria-label="Progreso hacia el envío gratis">${money(progress)} de ${money(shipping.freeFrom)}</progress>
    </div>
  </aside>`;
}

function productCard(product, cart) {
  const soldOut = product.stock < 1;
  const limit = (cart.items.get(product.id) ?? 0) >= product.stock;
  return `<article class="product-card">
    <div class="card-photo">${photo(product)}</div>
    <div class="card-details">
      <h3>${product.name}</h3>
      <p>${product.detail}</p>
      <div class="card-bottom">
        <strong>${money(product.price)}</strong>
        <button class="button card-add" data-action="add" data-id="${product.id}" aria-label="${limit ? (soldOut ? 'Agotado' : 'Cantidad máxima') + ' · ' + product.name : 'Añadir ' + product.name + ' al carrito'}" ${limit ? 'disabled' : ''}>${limit ? (soldOut ? 'Agotado' : 'Máximo') : `${icon('plus')} Añadir`}</button>
      </div>
    </div>
  </article>`;
}

export function cartView(cart, quote, products, promoOpen) {
  const recommendations = products.filter(product => !cart.items.has(product.id) && product.stock > 0).slice(0, 3);
  return intro('Tu carrito', quote.count ? `${quote.count} ${itemLabel(quote.count)} en tu cesta` : 'Tu cesta está vacía', 'Carrito') +
    (quote.count
      ? `<div class="cart-layout">
        <section class="cart-content" aria-labelledby="cart-lines-title">
          <h2 class="sr-only" id="cart-lines-title">Productos en el carrito</h2>
          <div class="cart-head" aria-hidden="true"><span>Producto</span><span>Cantidad</span><span>Total</span></div>
          <ul class="cart-lines">${quote.lines.map(cartLine).join('')}</ul>
          <a href="#tienda" class="inline-link continue-link">${icon('arrow-left')} Seguir comprando</a>
        </section>
        ${summary(quote, cart.coupon, promoOpen)}
      </div>`
      : `<section class="empty-cart">
        <span class="empty-icon">${icon('bag')}</span><h2>Hay sitio para algo bonito</h2>
        <a class="button primary" href="#tienda">Explorar la tienda ${icon('arrow-right')}</a>
      </section>`) +
    (recommendations.length ? `<section class="recommendations" aria-labelledby="recommendations-title">
      <div class="section-heading"><div><h2 id="recommendations-title">También te puede gustar</h2><p>Pequeños detalles para disfrutar a diario.</p></div>
      <a class="inline-link" href="#tienda">Ver toda la tienda ${icon('arrow-right')}</a></div>
      <div class="product-grid">${recommendations.map(product => productCard(product, cart)).join('')}</div>
    </section>` : '');
}

export function shopView(cart, products, category, visible) {
  const selection = categories.find(entry => entry.id === category);
  const activeProducts = selection ? products.filter(product => product.category === category) : products;
  return intro(selection?.name ?? 'La tienda', selection?.description ?? 'Objetos para vivir despacio.', 'Tienda') +
    `<nav class="filters" aria-label="Filtrar por colección">
      <a href="#tienda" ${selection ? '' : 'aria-current="page"'}>Todo</a>
      ${categories.map(entry => `<a href="#tienda/${entry.id}" ${selection === entry ? 'aria-current="page"' : ''}>${entry.name}</a>`).join('')}
    </nav>
    <section aria-label="Productos de la tienda" class="shop-products">
      ${activeProducts.length ? `<div class="product-grid">${activeProducts.slice(0, visible).map(product => productCard(product, cart)).join('')}</div>` : '<p>No hay productos en esta colección por el momento.</p>'}
      ${activeProducts.length > visible ? '<button class="button card-add more-button" data-action="more">Ver más productos</button>' : ''}
    </section>`;
}

export function collectionsView(catalog) {
  return intro('Colecciones', 'Encuentra tus favoritos por colección.', 'Colecciones') +
    `<div class="product-grid collection-grid">${categories.map(category => `<a class="product-card collection-card" href="#tienda/${category.id}">
      <div class="card-photo">${photo(catalog.get(category.cover))}</div>
      <div class="card-details"><h2>${category.name}</h2><p>${category.description}</p><span class="inline-link">Ver colección ${icon('arrow-right')}</span></div>
    </a>`).join('')}</div>`;
}

export function checkoutView(quote) {
  return `<button type="button" class="dialog-close" data-action="close-dialog" aria-label="Cerrar">${icon('close')}</button>
    <span class="empty-icon">${icon('bag')}</span><h2 id="checkout-title">Confirma tu pedido</h2>
    <p>Simulación de compra · Sin cargo</p>
    <div class="dialog-lines">${quote.lines.map(({ product, quantity, total }) => `<div><span>${product.name} × ${quantity}</span><span>${money(total)}</span></div>`).join('')}</div>
    <div class="grand-total"><span>Total</span><strong>${money(quote.total)}</strong></div>
    <button class="button primary" type="button" data-action="confirm">Confirmar pedido de prueba ${icon('arrow-right')}</button>`;
}

export function confirmationView() {
  return `<button type="button" class="dialog-close" data-action="close-dialog" aria-label="Cerrar">${icon('close')}</button>
    <span class="empty-icon">${icon('check')}</span><h2 id="checkout-title">¡Pedido de prueba confirmado!</h2>
    <p>La simulación ha terminado y tu carrito está vacío.</p>
    <a class="button primary" href="#tienda" data-action="close-dialog">Volver a la tienda ${icon('arrow-right')}</a>`;
}
