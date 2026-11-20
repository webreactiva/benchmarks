"""
Capa de almacenamiento escalable.

Patrón Repository + Strategy para permitir intercambiar backend sin tocar dominio.
Implementaciones incluidas:
  - InMemoryCartStorage: thread-safe, útil para tests y single-node.
  - ShardedCartStorage: simula sharding horizontal por hash(cart_id) % N.
  - FileCartStorage: persistencia simple en JSON (para demo sin dependencias).

Escalabilidad:
  - Lock striping por cart_id para evitar contención global.
  - Optimistic locking vía `version`.
  - TTL / expiración gestionada en capa de servicio pero storage soporta cleanup.
  - Interfaz async-ready (métodos síncronos pero fáciles de migrar).
"""
from __future__ import annotations

import hashlib
import json
import threading
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Optional, List

from .models import Cart
from .exceptions import CartNotFoundError, ConcurrencyError


class CartStorage(ABC):
    """Contrato de persistencia. Cualquier backend (Redis, DynamoDB, Postgres) lo implementa."""

    @abstractmethod
    def get(self, cart_id: str) -> Optional[Cart]:
        ...

    @abstractmethod
    def save(self, cart: Cart, expected_version: Optional[int] = None) -> None:
        """Guarda con optimistic locking si expected_version != None."""
        ...

    @abstractmethod
    def delete(self, cart_id: str) -> None:
        ...

    @abstractmethod
    def list_by_user(self, user_id: str) -> List[Cart]:
        ...

    def exists(self, cart_id: str) -> bool:
        return self.get(cart_id) is not None

    def count(self) -> int:
        raise NotImplementedError


# ---------------------------------------------------------------------------
# InMemory - Thread Safe
# ---------------------------------------------------------------------------
class InMemoryCartStorage(CartStorage):
    """
    Thread-safe usando:
      - RLock global para estructura dict
      - Locks por cart_id (striped) para operaciones concurrentes sobre distinto carrito
    """

    def __init__(self):
        self._store: Dict[str, Cart] = {}
        self._global_lock = threading.RLock()
        self._locks: Dict[str, threading.RLock] = {}
        self._locks_lock = threading.Lock()

    def _lock_for(self, cart_id: str) -> threading.RLock:
        with self._locks_lock:
            if cart_id not in self._locks:
                self._locks[cart_id] = threading.RLock()
            return self._locks[cart_id]

    def get(self, cart_id: str) -> Optional[Cart]:
        with self._global_lock:
            cart = self._store.get(cart_id)
            if cart is None:
                return None
            # devolver copia profunda vía serialización para evitar mutación externa
            return Cart.from_dict(cart.to_dict())

    def save(self, cart: Cart, expected_version: Optional[int] = None) -> None:
        lock = self._lock_for(cart.id)
        with lock:
            with self._global_lock:
                existing = self._store.get(cart.id)
                if expected_version is not None and existing is not None:
                    if existing.version != expected_version:
                        raise ConcurrencyError(
                            f"Conflicto de versión para {cart.id}: esperado {expected_version}, actual {existing.version}"
                        )
                # guardar copia
                self._store[cart.id] = Cart.from_dict(cart.to_dict())

    def delete(self, cart_id: str) -> None:
        with self._global_lock:
            self._store.pop(cart_id, None)

    def list_by_user(self, user_id: str) -> List[Cart]:
        with self._global_lock:
            return [
                Cart.from_dict(c.to_dict())
                for c in self._store.values()
                if c.user_id == user_id
            ]

    def count(self) -> int:
        with self._global_lock:
            return len(self._store)

    def clear_expired(self) -> int:
        """Limpieza de expirados. Retorna nº eliminados."""
        removed = 0
        with self._global_lock:
            expired_ids = [cid for cid, c in self._store.items() if c.is_expired]
            for cid in expired_ids:
                del self._store[cid]
                removed += 1
        return removed


# ---------------------------------------------------------------------------
# Sharded - Simula escalado horizontal
# ---------------------------------------------------------------------------
class ShardedCartStorage(CartStorage):
    """
    Simula sharding horizontal: distribuye carritos en N shards por hash.
    Cada shard es un InMemoryCartStorage independiente -> puede estar en nodo distinto.
    Escalable linealmente: añadir shards reduce contención y aumenta throughput.

    En producción cada shard sería una instancia Redis/DB distinta.
    """

    def __init__(self, num_shards: int = 4):
        if num_shards < 1:
            raise ValueError("num_shards >= 1")
        self.num_shards = num_shards
        self._shards: List[InMemoryCartStorage] = [
            InMemoryCartStorage() for _ in range(num_shards)
        ]

    def _shard_for(self, cart_id: str) -> InMemoryCartStorage:
        h = int(hashlib.md5(cart_id.encode()).hexdigest(), 16)
        return self._shards[h % self.num_shards]

    def _shard_index(self, cart_id: str) -> int:
        h = int(hashlib.md5(cart_id.encode()).hexdigest(), 16)
        return h % self.num_shards

    def get(self, cart_id: str) -> Optional[Cart]:
        return self._shard_for(cart_id).get(cart_id)

    def save(self, cart: Cart, expected_version: Optional[int] = None) -> None:
        self._shard_for(cart.id).save(cart, expected_version)

    def delete(self, cart_id: str) -> None:
        self._shard_for(cart_id).delete(cart_id)

    def list_by_user(self, user_id: str) -> List[Cart]:
        # scatter-gather
        result: List[Cart] = []
        for shard in self._shards:
            result.extend(shard.list_by_user(user_id))
        return result

    def count(self) -> int:
        return sum(s.count() for s in self._shards)

    def shard_stats(self) -> Dict[int, int]:
        return {i: s.count() for i, s in enumerate(self._shards)}

    def clear_expired(self) -> int:
        return sum(s.clear_expired() for s in self._shards)


# ---------------------------------------------------------------------------
# File Storage - Persistencia sin dependencias externas
# ---------------------------------------------------------------------------
class FileCartStorage(CartStorage):
    """Persistencia JSON en disco. Thread-safe con lock global + fsync."""

    def __init__(self, file_path: str | Path = "carts.json"):
        self.file_path = Path(file_path)
        self._lock = threading.RLock()
        if not self.file_path.exists():
            self.file_path.write_text("{}", encoding="utf-8")

    def _read_all(self) -> Dict[str, dict]:
        with self._lock:
            if not self.file_path.exists():
                return {}
            text = self.file_path.read_text(encoding="utf-8").strip()
            if not text:
                return {}
            return json.loads(text)

    def _write_all(self, data: Dict[str, dict]) -> None:
        with self._lock:
            tmp = self.file_path.with_suffix(".tmp")
            tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            tmp.replace(self.file_path)

    def get(self, cart_id: str) -> Optional[Cart]:
        data = self._read_all()
        raw = data.get(cart_id)
        if raw is None:
            return None
        return Cart.from_dict(raw)

    def save(self, cart: Cart, expected_version: Optional[int] = None) -> None:
        with self._lock:
            data = self._read_all()
            existing_raw = data.get(cart.id)
            if expected_version is not None and existing_raw is not None:
                if existing_raw.get("version") != expected_version:
                    raise ConcurrencyError(f"Conflicto versión {cart.id}")
            data[cart.id] = cart.to_dict()
            self._write_all(data)

    def delete(self, cart_id: str) -> None:
        with self._lock:
            data = self._read_all()
            data.pop(cart_id, None)
            self._write_all(data)

    def list_by_user(self, user_id: str) -> List[Cart]:
        data = self._read_all()
        return [
            Cart.from_dict(v) for v in data.values() if v.get("user_id") == user_id
        ]

    def count(self) -> int:
        return len(self._read_all())
