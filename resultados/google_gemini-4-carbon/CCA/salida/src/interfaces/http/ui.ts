export function renderPlaygroundHtml(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Carrito Escalable — Consola Interactiva</title>
  <style>
    :root {
      --bg: #0f172a;
      --panel: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --accent-hover: #0284c7;
      --ok: #22c55e;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    header {
      padding: 1.25rem 2rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    header h1 { margin: 0; font-size: 1.25rem; }
    .badge {
      background: #0369a1;
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      font-size: 0.8rem;
      font-family: monospace;
    }
    main {
      max-width: 1240px;
      margin: 1.5rem auto;
      padding: 0 1.5rem;
      display: grid;
      grid-template-columns: 1.35fr 1fr;
      gap: 1.5rem;
    }
    @media (max-width: 900px) {
      main { grid-template-columns: 1fr; }
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1.25rem;
    }
    h2 { margin-top: 0; font-size: 1.05rem; }
    .catalog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 1rem;
    }
    .prod {
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      padding: 0.9rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.65rem;
    }
    .prod-price { font-weight: 700; color: var(--accent); }
    .muted { color: var(--muted); font-size: 0.85rem; }
    button {
      background: var(--accent);
      color: #0f172a;
      border: none;
      font-weight: 600;
      padding: 0.45rem 0.8rem;
      border-radius: 0.4rem;
      cursor: pointer;
    }
    button:hover { background: var(--accent-hover); color: white; }
    button.secondary { background: #334155; color: var(--text); }
    button.danger { background: var(--danger); color: white; }
    input {
      background: #0f172a;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.45rem 0.65rem;
      border-radius: 0.4rem;
    }
    .cart-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.55rem 0;
      border-bottom: 1px solid var(--border);
      gap: 0.5rem;
    }
    .totals { margin-top: 1rem; font-size: 0.92rem; }
    .totals div { display: flex; justify-content: space-between; margin: 0.25rem 0; }
    .grand { font-size: 1.1rem; font-weight: 700; color: var(--ok); border-top: 1px solid var(--border); padding-top: 0.5rem; }
    .row { display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }
    #statusBox { margin-top: 0.85rem; font-size: 0.85rem; color: var(--accent); min-height: 1.2rem; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Carrito de la Compra Escalable</h1>
      <span class="muted">Arquitectura Hexagonal · OCC (ETag/Version) · Idempotencia · L1+SQLite WAL</span>
    </div>
    <div>
      <span id="cartMeta" class="badge">Inicializando sesión...</span>
    </div>
  </header>
  <main>
    <section class="card">
      <h2>Catálogo de Productos (Stock en Tiempo Real)</h2>
      <div id="catalog" class="catalog-grid"></div>
    </section>
    <section class="card">
      <h2>Tu Carrito</h2>
      <div id="cartItems"></div>
      <div id="cartTotals" class="totals"></div>
      <div class="row">
        <input id="couponInput" placeholder="Cupón (ej. BIENVENIDA10)" />
        <button class="secondary" onclick="applyCoupon()">Aplicar cupón</button>
        <button class="secondary" onclick="removeCoupon()">Quitar</button>
      </div>
      <div class="row">
        <input id="userInput" placeholder="Login userId (ej. usr_ana)" />
        <button class="secondary" onclick="mergeToUser()">Fusionar a Usuario</button>
      </div>
      <div class="row" style="margin-top:1rem;">
        <button onclick="checkoutCart()">Finalizar Compra (Checkout)</button>
        <button class="danger" onclick="clearCart()">Vaciar</button>
      </div>
      <div id="statusBox"></div>
    </section>
  </main>
  <script>
    const sessionKey = 'demo_session_id';
    let sessionId = localStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(sessionKey, sessionId);
    }
    let currentCart = null;

    function notify(msg) {
      document.getElementById('statusBox').textContent = msg;
    }

    async function api(path, opts = {}) {
      const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
      if (currentCart && opts.method && opts.method !== 'GET') {
        headers['If-Match'] = 'W/"v' + currentCart.version + '"';
        headers['Idempotency-Key'] = crypto.randomUUID();
      }
      const res = await fetch(path, Object.assign({}, opts, { headers }));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Error en API');
      return data;
    }

    async function loadCatalog() {
      const { products } = await api('/api/v1/products');
      const el = document.getElementById('catalog');
      el.innerHTML = products.map(p => \`
        <div class="prod">
          <div>
            <strong>\${p.name}</strong>
            <div class="muted">\${p.sku} · Stock: \${p.availableStock}</div>
            <p class="muted">\${p.description}</p>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="prod-price">\${(p.unitPriceMinor / 100).toFixed(2)} \${p.currency}</span>
            <button onclick="addItem('\${p.sku}')">+ Añadir</button>
          </div>
        </div>
      \`).join('');
    }

    async function initCart() {
      const { cart } = await api('/api/v1/carts', {
        method: 'POST',
        body: JSON.stringify({ sessionId })
      });
      renderCart(cart);
    }

    function renderCart(cart) {
      currentCart = cart;
      document.getElementById('cartMeta').textContent =
        \`\${cart.id.slice(0, 13)}… | v\${cart.version} | \${cart.userId ? 'User: ' + cart.userId : 'Invitado'}\`;
      const itemsEl = document.getElementById('cartItems');
      if (!cart.items.length) {
        itemsEl.innerHTML = '<p class="muted">El carrito está vacío.</p>';
      } else {
        itemsEl.innerHTML = cart.items.map(i => \`
          <div class="cart-line">
            <div>
              <div><strong>\${i.name}</strong></div>
              <div class="muted">\${i.unitPrice.formatted} x \${i.quantity} = \${i.lineSubtotal.formatted}</div>
            </div>
            <div style="display:flex;gap:0.35rem;">
              <button class="secondary" onclick="setQty('\${i.sku}', \${i.quantity - 1})">-</button>
              <button class="secondary" onclick="setQty('\${i.sku}', \${i.quantity + 1})">+</button>
            </div>
          </div>
        \`).join('');
      }
      const p = cart.pricing;
      document.getElementById('cartTotals').innerHTML = \`
        <div><span>Subtotal (\${p.totalUnits} uds)</span><span>\${p.subtotal.formatted}</span></div>
        \${p.discounts.map(d => \`<div style="color:#38bdf8"><span>Dto \${d.code}</span><span>-\${d.amount.formatted}</span></div>\`).join('')}
        <div><span>IVA (\${(p.taxRateBps / 100).toFixed(0)}%)</span><span>\${p.taxAmount.formatted}</span></div>
        <div><span>Envío</span><span>\${p.shippingAmount.formatted}</span></div>
        <div class="grand"><span>Total</span><span>\${p.grandTotal.formatted}</span></div>
      \`;
    }

    async function addItem(sku) {
      try {
        const { cart } = await api(\`/api/v1/carts/\${currentCart.id}/items\`, {
          method: 'POST',
          body: JSON.stringify({ sku, quantity: 1 })
        });
        renderCart(cart);
        notify('Artículo añadido (v' + cart.version + ')');
      } catch (e) { notify(e.message); }
    }

    async function setQty(sku, quantity) {
      try {
        const { cart } = await api(\`/api/v1/carts/\${currentCart.id}/items/\${encodeURIComponent(sku)}\`, {
          method: 'PUT',
          body: JSON.stringify({ quantity })
        });
        renderCart(cart);
      } catch (e) { notify(e.message); }
    }

    async function applyCoupon() {
      const code = document.getElementById('couponInput').value.trim();
      if (!code) return;
      try {
        const { cart } = await api(\`/api/v1/carts/\${currentCart.id}/coupons\`, {
          method: 'POST',
          body: JSON.stringify({ code })
        });
        renderCart(cart);
        notify('Cupón ' + code.toUpperCase() + ' aplicado');
      } catch (e) { notify(e.message); }
    }

    async function removeCoupon() {
      try {
        const { cart } = await api(\`/api/v1/carts/\${currentCart.id}/coupons\`, { method: 'DELETE' });
        renderCart(cart);
        notify('Cupón eliminado');
      } catch (e) { notify(e.message); }
    }

    async function mergeToUser() {
      const userId = document.getElementById('userInput').value.trim();
      if (!userId) return notify('Introduce un userId');
      try {
        const { cart } = await api('/api/v1/carts/merge', {
          method: 'POST',
          headers: {},
          body: JSON.stringify({ guestCartId: currentCart.id, userId })
        });
        renderCart(cart);
        notify('Carrito fusionado a ' + userId);
      } catch (e) { notify(e.message); }
    }

    async function clearCart() {
      try {
        const { cart } = await api(\`/api/v1/carts/\${currentCart.id}/items\`, { method: 'DELETE' });
        renderCart(cart);
        notify('Carrito vaciado');
      } catch (e) { notify(e.message); }
    }

    async function checkoutCart() {
      try {
        const { order } = await api(\`/api/v1/carts/\${currentCart.id}/checkout\`, {
          method: 'POST',
          body: JSON.stringify({ customerEmail: 'cliente@ejemplo.es' })
        });
        notify('Orden confirmada: ' + order.orderId + ' (' + order.pricing.grandTotal.formatted + ')');
        sessionId = 'sess_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(sessionKey, sessionId);
        await loadCatalog();
        await initCart();
      } catch (e) { notify(e.message); }
    }

    loadCatalog().then(initCart);
  </script>
</body>
</html>`;
}
