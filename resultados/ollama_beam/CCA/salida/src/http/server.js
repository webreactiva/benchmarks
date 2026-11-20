const http = require('node:http');
const { CartManager } = require('../cartManager');
const { InMemoryInventory } = require('../inventory');

const port = process.env.PORT || 3000;
const manager = new CartManager({ inventory: new InMemoryInventory() });

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function parseBody(req) {
  let data = '';
  for await (const chunk of req) data += chunk;
  if (!data) return {};
  return JSON.parse(data);
}

function match(pathname, pattern) {
  const parts = pathname.split('/').filter(Boolean);
  const pat = pattern.split('/').filter(Boolean);
  if (parts.length !== pat.length) return null;
  const params = {};
  for (let i = 0; i < pat.length; i++) {
    if (pat[i].startsWith(':')) params[pat[i].slice(1)] = decodeURIComponent(parts[i]);
    else if (pat[i] !== parts[i]) return null;
  }
  return params;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (req.method === 'POST' && pathname === '/carts') {
      const body = await parseBody(req);
      const cart = await manager.createCart(body);
      return send(res, 201, cart.toJSON());
    }

    let params = match(pathname, '/carts/:id');
    if (req.method === 'GET' && params) {
      const cart = await manager.getCart(params.id);
      return send(res, 200, cart.toJSON());
    }

    params = match(pathname, '/carts/:id/items');
    if (req.method === 'POST' && params) {
      const body = await parseBody(req);
      const cart = await manager.addItem(params.id, body);
      return send(res, 200, cart.toJSON());
    }

    params = match(pathname, '/carts/:id/items/:productId');
    if (req.method === 'PATCH' && params) {
      const body = await parseBody(req);
      const cart = await manager.updateQuantity(params.id, params.productId, body.quantity);
      return send(res, 200, cart.toJSON());
    }
    if (req.method === 'DELETE' && params) {
      const cart = await manager.removeItem(params.id, params.productId);
      return send(res, 200, cart.toJSON());
    }

    params = match(pathname, '/carts/:id/clear');
    if (req.method === 'POST' && params) {
      const cart = await manager.clear(params.id);
      return send(res, 200, cart.toJSON());
    }

    params = match(pathname, '/carts/:id/coupons/:code');
    if (req.method === 'POST' && params) {
      const cart = await manager.applyCoupon(params.id, params.code);
      return send(res, 200, cart.toJSON());
    }

    send(res, 404, { error: 'not found' });
  } catch (err) {
    send(res, 400, { error: err.message });
  }
});

if (require.main === module) {
  server.listen(port, () => console.log(`cart server listening on ${port}`));
}

module.exports = { server, manager };
