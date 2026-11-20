from __future__ import annotations

import json
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlsplit

from ..application.ports import EventPublisher
from ..application.services import CartService
from ..domain.exceptions import CartError
from ..infrastructure.memory import (
    InMemoryCartRepository,
    InMemoryEventPublisher,
    InMemoryProductRepository,
)


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def build_service(publisher: EventPublisher | None = None) -> CartService:
    return CartService(
        carts=InMemoryCartRepository(),
        products=InMemoryProductRepository(),
        publisher=publisher if publisher is not None else InMemoryEventPublisher(),
    )


def _as_quantity(value: Any) -> int:
    if isinstance(value, bool) or value is None:
        raise ApiError(400, "invalid_quantity", "quantity must be a positive integer")
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    raise ApiError(400, "invalid_quantity", "quantity must be a positive integer")


class CartRequestHandler(BaseHTTPRequestHandler):
    server_version = "CartAPI/1.0"

    @property
    def service(self) -> CartService:
        return self.server.service

    def log_message(self, format: str, *args) -> None:
        pass

    def do_GET(self) -> None:
        self._route("GET")

    def do_POST(self) -> None:
        self._route("POST")

    def do_PATCH(self) -> None:
        self._route("PATCH")

    def do_DELETE(self) -> None:
        self._route("DELETE")

    def _route(self, method: str) -> None:
        try:
            segments = [part for part in urlsplit(self.path).path.split("/") if part]
            payload = self._dispatch(method, segments)
            self._send_json(200, payload)
        except ApiError as err:
            self._send_json(err.status, {"error": {"code": err.code, "message": err.message}})
        except CartError as err:
            self._send_json(err.http_status, {"error": {"code": err.code, "message": err.message}})
        except Exception:
            traceback.print_exc(file=sys.stderr)
            self._send_json(500, {"error": {"code": "internal_error", "message": "unexpected server error"}})

    def _dispatch(self, method: str, segments: list[str]) -> Any:
        service = self.service

        if segments == ["health"] and method == "GET":
            return {"status": "ok"}

        if segments == ["products"]:
            if method == "GET":
                return {"products": [p.to_dict() for p in service.list_products()]}
            if method == "POST":
                body = self._read_json()
                product = service.create_product(
                    name=body.get("name"),
                    price=body.get("price"),
                    product_id=body.get("id"),
                )
                return {"product": product.to_dict()}

        if segments == ["carts"] and method == "POST":
            self._read_json()
            return {"cart": service.create_cart()}

        if len(segments) == 2 and segments[0] == "carts":
            cart_id = segments[1]
            if method == "GET":
                return {"cart": service.get_cart(cart_id)}
            if method == "DELETE":
                service.delete_cart(cart_id)
                return {"deleted": cart_id}

        if len(segments) == 3 and segments[0] == "carts" and segments[2] == "items" and method == "POST":
            cart_id = segments[1]
            body = self._read_json()
            product_id = body.get("product_id")
            if not isinstance(product_id, str) or not product_id:
                raise ApiError(400, "invalid_product_id", "product_id must be a non-empty string")
            cart = service.add_item(cart_id, product_id, _as_quantity(body.get("quantity")))
            return {"cart": cart}

        if len(segments) == 4 and segments[0] == "carts" and segments[2] == "items":
            cart_id = segments[1]
            product_id = segments[3]
            if method == "PATCH":
                body = self._read_json()
                cart = service.update_item(cart_id, product_id, _as_quantity(body.get("quantity")))
                return {"cart": cart}
            if method == "DELETE":
                cart = service.remove_item(cart_id, product_id)
                return {"cart": cart}

        if len(segments) == 3 and segments[0] == "carts" and segments[2] == "checkout" and method == "POST":
            self._read_json()
            cart = service.checkout_cart(segments[1])
            return {"cart": cart}

        raise ApiError(404, "not_found", f"no route for {method} /{'/'.join(segments)}")

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        if not raw:
            return {}
        try:
            data = json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ApiError(400, "invalid_json", "request body is not valid JSON") from None
        if not isinstance(data, dict):
            raise ApiError(400, "invalid_body", "request body must be a JSON object")
        return data

    def _send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class CartHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, service: CartService) -> None:
        super().__init__(address, CartRequestHandler)
        self.service = service
