"""Puerto de persistencia + adaptadores. Escritura con compare-and-swap sobre `version`."""
from __future__ import annotations

import json
import threading
import time
from typing import Optional, Protocol

from .domain import Cart, ConcurrencyError


class CartRepository(Protocol):
    def get(self, cart_id: str) -> Optional[Cart]: ...

    def save(self, cart: Cart, expected_version: int) -> Cart:
        """Guarda `cart` solo si la versión almacenada == expected_version.
        Devuelve el carrito con version+1; lanza ConcurrencyError si no coincide."""

    def delete(self, cart_id: str) -> None: ...


class InMemoryCartRepository:
    """Para tests/desarrollo. Con TTL para que los carritos abandonados expiren."""

    def __init__(self, ttl_seconds: int = 7 * 24 * 3600, clock=time.monotonic):
        self._data: dict[str, tuple[Cart, float]] = {}
        self._lock = threading.Lock()
        self._ttl, self._clock = ttl_seconds, clock

    def get(self, cart_id):
        with self._lock:
            entry = self._data.get(cart_id)
            if entry and entry[1] > self._clock():
                return entry[0]
            self._data.pop(cart_id, None)
            return None

    def save(self, cart, expected_version):
        with self._lock:
            entry = self._data.get(cart.id)
            stored = entry[0].version if entry and entry[1] > self._clock() else 0
            if stored != expected_version:
                raise ConcurrencyError(cart.id)
            from dataclasses import replace
            saved = replace(cart, version=expected_version + 1)
            self._data[cart.id] = (saved, self._clock() + self._ttl)
            return saved

    def delete(self, cart_id):
        with self._lock:
            self._data.pop(cart_id, None)


_CAS_LUA = """
local cur = redis.call('GET', KEYS[2])
if (cur == false and ARGV[1] == '0') or cur == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  redis.call('SET', KEYS[2], ARGV[1] + 1, 'EX', ARGV[3])
  return 1
end
return 0
"""


class RedisCartRepository:
    """Adaptador Redis (requiere `pip install redis`). El CAS es atómico vía Lua,
    por lo que N instancias de la app pueden escribir sin locks distribuidos.
    Con Redis Cluster ambas claves comparten hash tag {cart_id}."""

    def __init__(self, client, ttl_seconds: int = 7 * 24 * 3600, prefix: str = "cart"):
        self._r, self._ttl, self._p = client, ttl_seconds, prefix
        self._cas = client.register_script(_CAS_LUA)

    def _keys(self, cart_id):
        return f"{self._p}:{{{cart_id}}}:data", f"{self._p}:{{{cart_id}}}:ver"

    def get(self, cart_id):
        raw = self._r.get(self._keys(cart_id)[0])
        return Cart.from_dict(json.loads(raw)) if raw else None

    def save(self, cart, expected_version):
        from dataclasses import replace
        saved = replace(cart, version=expected_version + 1)
        data_k, ver_k = self._keys(cart.id)
        ok = self._cas(keys=[data_k, ver_k],
                       args=[expected_version, json.dumps(saved.to_dict()), self._ttl])
        if not ok:
            raise ConcurrencyError(cart.id)
        return saved

    def delete(self, cart_id):
        self._r.delete(*self._keys(cart_id))
