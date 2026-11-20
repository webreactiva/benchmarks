import json
import threading
import urllib.error
import urllib.request

import pytest

from cart.api.http import CartHTTPServer, build_service


@pytest.fixture()
def base_url():
    server = CartHTTPServer(("127.0.0.1", 0), build_service())
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()
    server.server_close()
    thread.join(timeout=5)


def request(method: str, url: str, body: dict | None = None, raw: bytes | None = None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            payload = response.read()
            return response.status, json.loads(payload) if payload else None
    except urllib.error.HTTPError as err:
        payload = err.read()
        return err.code, json.loads(payload) if payload else None


def test_health(base_url):
    status, body = request("GET", f"{base_url}/health")
    assert status == 200 and body == {"status": "ok"}


def test_full_purchase_flow(base_url):
    status, created = request("POST", f"{base_url}/products", {"name": "Keyboard", "price": "49.90"})
    assert status == 200
    product_id = created["product"]["id"]

    status, created_cart = request("POST", f"{base_url}/carts")
    cart_id = created_cart["cart"]["id"]

    status, after_add = request("POST", f"{base_url}/carts/{cart_id}/items", {"product_id": product_id, "quantity": 2})
    assert status == 200
    assert after_add["cart"]["total"] == "99.80"
    assert after_add["cart"]["total_units"] == 2

    status, after_patch = request("PATCH", f"{base_url}/carts/{cart_id}/items/{product_id}", {"quantity": 1})
    assert after_patch["cart"]["total"] == "49.90"
    assert after_patch["cart"]["version"] == 2

    status, after_delete = request("DELETE", f"{base_url}/carts/{cart_id}/items/{product_id}")
    assert after_delete["cart"]["item_count"] == 0

    request("POST", f"{base_url}/carts/{cart_id}/items", {"product_id": product_id, "quantity": 3})
    data = request("GET", f"{base_url}/carts/{cart_id}")[1]["cart"]
    assert data["total_units"] == 3

    status, checked = request("POST", f"{base_url}/carts/{cart_id}/checkout")
    assert status == 200 and checked["cart"]["status"] == "checked_out"
    assert checked["cart"]["total"] == "149.70"

    status, second = request("POST", f"{base_url}/carts/{cart_id}/checkout")
    assert status == 409 and second["error"]["code"] == "cart_already_checked_out"

    status, _ = request("DELETE", f"{base_url}/carts/{cart_id}")
    assert status == 200
    status, missing = request("GET", f"{base_url}/carts/{cart_id}")
    assert status == 404 and missing["error"]["code"] == "cart_not_found"


def test_validation_errors(base_url):
    status, body = request("POST", f"{base_url}/products", {"name": "", "price": "1"})
    assert status == 400 and body["error"]["code"] == "invalid_product"

    status, body = request("POST", f"{base_url}/products", {"name": "X", "price": "abc"})
    assert status == 400 and body["error"]["code"] == "invalid_product"

    status, _ = request("POST", f"{base_url}/carts")
    assert status == 200

    request("POST", f"{base_url}/products", {"name": "Keyboard", "price": "9.99", "id": "kb"})
    status, body = request("POST", f"{base_url}/carts/nope/items", {"product_id": "kb", "quantity": 1})
    assert status == 404 and body["error"]["code"] == "cart_not_found"

    cart = request("POST", f"{base_url}/carts")[1]["cart"]
    status, body = request("POST", f"{base_url}/carts/{cart['id']}/items", {"product_id": "p", "quantity": "abc"})
    assert status == 400 and body["error"]["code"] == "invalid_quantity"

    status, body = request("POST", f"{base_url}/carts/{cart['id']}/items", {"quantity": 1})
    assert status == 400 and body["error"]["code"] == "invalid_product_id"

    status, _ = request("POST", f"{base_url}/carts/{cart['id']}/items", raw=b"{not json")
    assert status == 400

    status, body = request("GET", f"{base_url}/unknown/route")
    assert status == 404 and body["error"]["code"] == "not_found"
