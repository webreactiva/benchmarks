"""
API REST minimalista sin dependencias externas (stdlib http.server).
Escalable: stateless, puede correr tras Nginx/LB.

Para producción con FastAPI, ver api/fastapi_app.py
"""
from __future__ import annotations
import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
from decimal import Decimal

from cart import (
    InMemoryCartStorage, ShardedCartStorage,
    InMemoryInventory, CartService, EventBus,
    PricingEngine, BulkDiscountRule, CategoryDiscountRule, CouponDiscountRule,
    Coupon, CouponType, TaxCalculator, ShippingCalculator, Money
)
from cart.models import Product

# -- Bootstrap -------------------------------------------------------------
inventory = InMemoryInventory.with_sample_data()
storage = ShardedCartStorage(num_shards=4)
event_bus = EventBus()

# Cupones demo
coupons = {
    "BIENVENIDO10": Coupon("BIENVENIDO10", CouponType.PERCENTAGE, Decimal("10"), min_purchase=Money(Decimal("30"))),
    "FIJO5": Coupon("FIJO5", CouponType.FIXED, Decimal("5"), min_purchase=Money(Decimal("20"))),
    "ENVIOGRATIS": Coupon("ENVIOGRATIS", CouponType.FREE_SHIPPING, Decimal("0")),
}

pricing = PricingEngine(
    rules=[
        BulkDiscountRule(product_id="P002", min_quantity=3, discount_percent=Decimal("15")),
        CategoryDiscountRule(category="books", discount_percent=Decimal("10")),
        CouponDiscountRule(coupons=coupons),
    ],
    tax_calculator=TaxCalculator(default_rate=Decimal("0.21"), category_rates={"books": Decimal("0.04")}),
    shipping_calculator=ShippingCalculator(
        free_shipping_threshold=Money(Decimal("50")),
        flat_rate=Money(Decimal("4.99")),
        free_shipping_coupons={"ENVIOGRATIS"}
    )
)

service = CartService(storage=storage, inventory=inventory, pricing=pricing, event_bus=event_bus)

# Logging de eventos
event_bus.subscribe_all(lambda e: print(f"[EVENTO] {e.type.value} cart={e.cart_id} payload={e.payload}"))

# -- Helpers HTTP ----------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    def _send(self, code, data):
        body = json.dumps(data, ensure_ascii=False, indent=2).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        length = int(self.headers.get("Content-Length", 0))
        if not length:
            return {}
        return json.loads(self.rfile.read(length))

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # GET /products
        if path == "/products":
            prods = {k: v.to_dict() for k, v in inventory.list_products().items()}
            return self._send(200, prods)

        # GET /carts/:id
        m = re.match(r"^/carts/([^/]+)$", path)
        if m:
            try:
                cart = service.get_cart(m.group(1))
                pricing_data = service.get_pricing(cart.id)
                return self._send(200, {"cart": cart.to_dict(), "pricing": pricing_data.to_dict()})
            except Exception as e:
                return self._send(404, {"error": str(e)})

        # GET /carts/:id/pricing
        m = re.match(r"^/carts/([^/]+)/pricing$", path)
        if m:
            try:
                p = service.get_pricing(m.group(1))
                return self._send(200, p.to_dict())
            except Exception as e:
                return self._send(404, {"error": str(e)})

        # GET /stats
        if path == "/stats":
            return self._send(200, {
                "total_carts": storage.count(),
                "shard_stats": storage.shard_stats() if hasattr(storage, "shard_stats") else {},
                "products": len(inventory.list_products()),
            })

        return self._send(404, {"error": "Not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # POST /carts
        if path == "/carts":
            body = self._body()
            cart = service.create_cart(user_id=body.get("user_id"), currency=body.get("currency", "EUR"))
            return self._send(201, cart.to_dict())

        # POST /carts/:id/items
        m = re.match(r"^/carts/([^/]+)/items$", path)
        if m:
            try:
                body = self._body()
                cart = service.add_item(m.group(1), body["product_id"], int(body.get("quantity", 1)))
                return self._send(200, cart.to_dict())
            except Exception as e:
                return self._send(400, {"error": str(e)})

        # POST /carts/:id/coupon
        m = re.match(r"^/carts/([^/]+)/coupon$", path)
        if m:
            try:
                body = self._body()
                cart = service.apply_coupon(m.group(1), body["code"])
                return self._send(200, cart.to_dict())
            except Exception as e:
                return self._send(400, {"error": str(e)})

        # POST /carts/:id/checkout
        m = re.match(r"^/carts/([^/]+)/checkout$", path)
        if m:
            try:
                result = service.checkout(m.group(1))
                return self._send(200, result)
            except Exception as e:
                return self._send(400, {"error": str(e)})

        # POST /carts/:id/clear
        m = re.match(r"^/carts/([^/]+)/clear$", path)
        if m:
            try:
                cart = service.clear_cart(m.group(1))
                return self._send(200, cart.to_dict())
            except Exception as e:
                return self._send(400, {"error": str(e)})

        return self._send(404, {"error": "Not found"})

    def do_PUT(self):
        # PUT /carts/:id/items/:product_id  {quantity}
        m = re.match(r"^/carts/([^/]+)/items/([^/]+)$", self.path)
        if m:
            try:
                body = self._body()
                cart = service.update_quantity(m.group(1), m.group(2), int(body["quantity"]))
                return self._send(200, cart.to_dict())
            except Exception as e:
                return self._send(400, {"error": str(e)})
        return self._send(404, {"error": "Not found"})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        # DELETE /carts/:id/items/:product_id
        m = re.match(r"^/carts/([^/]+)/items/([^/]+)$", parsed.path)
        if m:
            try:
                cart = service.remove_item(m.group(1), m.group(2))
                return self._send(200, cart.to_dict())
            except Exception as e:
                return self._send(400, {"error": str(e)})

        # DELETE /carts/:id  -> borrar carrito
        m = re.match(r"^/carts/([^/]+)$", parsed.path)
        if m:
            service.delete_cart(m.group(1))
            return self._send(200, {"deleted": m.group(1)})

        # DELETE /carts/:id/coupon
        m = re.match(r"^/carts/([^/]+)/coupon$", parsed.path)
        if m:
            try:
                cart = service.remove_coupon(m.group(1))
                return self._send(200, cart.to_dict())
            except Exception as e:
                return self._send(400, {"error": str(e)})

        return self._send(404, {"error": "Not found"})

    def log_message(self, format, *args):
        print(f"[HTTP] {self.client_address[0]} - {format % args}")


def run(host="0.0.0.0", port=8000):
    print(f"🚀 Carrito API escuchando en http://{host}:{port}")
    print("Endpoints: POST /carts | POST /carts/:id/items | GET /carts/:id | POST /carts/:id/checkout")
    HTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    run()
