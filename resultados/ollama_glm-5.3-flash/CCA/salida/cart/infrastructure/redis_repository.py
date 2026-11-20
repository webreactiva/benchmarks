from __future__ import annotations

import json
from typing import Callable

from ..domain.exceptions import CartNotFoundError, DuplicateCartError, DuplicateProductError, ProductNotFoundError
from ..domain.events import CartEvent
from ..domain.models import Cart, Product


def _require_redis():
    try:
        import redis
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "the 'redis' package is required: pip install redis (or pip install 'shopping-cart[redis]')"
        ) from exc
    return redis


class RedisCartRepository:
    def __init__(self, client) -> None:
        self._client = client
        self._prefix = "cart:"

    def _key(self, cart_id: str) -> str:
        return f"{self._prefix}{cart_id}"

    def create(self, cart: Cart) -> Cart:
        encoded = json.dumps(cart.to_dict())
        if not self._client.set(self._key(cart.id), encoded, nx=True):
            raise DuplicateCartError(f"cart {cart.id} already exists")
        return cart

    def get(self, cart_id: str) -> Cart:
        raw = self._client.get(self._key(cart_id))
        if raw is None:
            raise CartNotFoundError(f"cart {cart_id} not found")
        return Cart.from_dict(json.loads(raw))

    def exists(self, cart_id: str) -> bool:
        return bool(self._client.exists(self._key(cart_id)))

    def update(self, cart_id: str, mutator: Callable[[Cart], object]) -> Cart:
        key = self._key(cart_id)
        while True:
            with self._client.pipeline() as pipe:
                try:
                    pipe.watch(key)
                    raw = pipe.get(key)
                    if raw is None:
                        raise CartNotFoundError(f"cart {cart_id} not found")
                    cart = Cart.from_dict(json.loads(raw))
                    mutator(cart)
                    pipe.multi()
                    pipe.set(key, json.dumps(cart.to_dict()))
                    pipe.execute()
                    return cart
                except self._client.WatchError:
                    continue

    def delete(self, cart_id: str) -> None:
        if not self._client.delete(self._key(cart_id)):
            raise CartNotFoundError(f"cart {cart_id} not found")


class RedisProductRepository:
    def __init__(self, client) -> None:
        self._client = client
        self._key = "products"

    def add(self, product: Product) -> Product:
        encoded = json.dumps(product.to_dict())
        if not self._client.hsetnx(self._key, product.id, encoded):
            raise DuplicateProductError(f"product {product.id} already exists")
        return product

    def get(self, product_id: str) -> Product:
        raw = self._client.hget(self._key, product_id)
        if raw is None:
            raise ProductNotFoundError(f"product {product_id} not found")
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        return Product.from_dict(json.loads(raw))

    def list(self, limit: int = 100, offset: int = 0) -> list[Product]:
        values = self._client.hvals(self._key)
        products = [Product.from_dict(json.loads(v if isinstance(v, str) else v.decode("utf-8"))) for v in values]
        return products[offset : offset + limit]

    def delete(self, product_id: str) -> None:
        if not self._client.hdel(self._key, product_id):
            raise ProductNotFoundError(f"product {product_id} not found")


class RedisEventPublisher:
    def __init__(self, client, channel: str = "cart_events") -> None:
        self._client = client
        self._channel = channel

    def publish(self, event: CartEvent) -> None:
        self._client.publish(self._channel, json.dumps(event.to_dict()))


def build_redis_service(redis_url: str):
    module = _require_redis()
    client = module.Redis.from_url(redis_url, decode_responses=True)
    from ..application.services import CartService

    return CartService(
        carts=RedisCartRepository(client),
        products=RedisProductRepository(client),
        publisher=RedisEventPublisher(client),
    )


__all__ = [
    "RedisCartRepository",
    "RedisEventPublisher",
    "RedisProductRepository",
    "build_redis_service",
]
