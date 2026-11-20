"""API HTTP JSON mínima (stdlib). En producción: gunicorn/uvicorn + N réplicas.

GET    /carts/{id}
POST   /carts/{id}/items        {"sku": "...", "quantity": 1}
PUT    /carts/{id}/items/{sku}  {"quantity": 3}
DELETE /carts/{id}/items/{sku}
DELETE /carts/{id}
"""
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .domain import CartError, ConcurrencyError, ProductNotFound
from .repository import InMemoryCartRepository
from .service import CartService, InMemoryCatalog

ID = r"([\w-]{1,64})"
ROUTES = [
    ("GET", rf"^/carts/{ID}$", lambda s, m, b: s.get(m[1])),
    ("POST", rf"^/carts/{ID}/items$", lambda s, m, b: s.add_item(m[1], b["sku"], b.get("quantity", 1))),
    ("PUT", rf"^/carts/{ID}/items/([\w.-]+)$", lambda s, m, b: s.set_quantity(m[1], m[2], b["quantity"])),
    ("DELETE", rf"^/carts/{ID}/items/([\w.-]+)$", lambda s, m, b: s.remove_item(m[1], m[2])),
    ("DELETE", rf"^/carts/{ID}$", lambda s, m, b: s.clear(m[1])),
]


def make_handler(service: CartService):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, status, payload=None):
            body = json.dumps(payload).encode() if payload is not None else b""
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _handle(self):
            try:
                length = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(length)) if length else {}
                for method, pattern, fn in ROUTES:
                    m = re.match(pattern, self.path)
                    if m and method == self.command:
                        result = fn(service, m, body)
                        return self._send(204) if result is None else self._send(200, result.to_dict())
                self._send(404, {"error": "no encontrado"})
            except ProductNotFound as e:
                self._send(404, {"error": f"producto no encontrado: {e}"})
            except ConcurrencyError as e:
                self._send(409, {"error": str(e)})
            except (CartError, KeyError, ValueError, TypeError) as e:
                self._send(400, {"error": str(e) or "petición inválida"})

        do_GET = do_POST = do_PUT = do_DELETE = _handle

        def log_message(self, *a):
            pass

    return Handler


if __name__ == "__main__":
    svc = CartService(InMemoryCartRepository(), InMemoryCatalog({"camiseta": 1999, "taza": 850}))
    print("Escuchando en http://localhost:8000")
    ThreadingHTTPServer(("", 8000), make_handler(svc)).serve_forever()
