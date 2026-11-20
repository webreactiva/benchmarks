"""Casos de uso. Sin estado: se puede replicar horizontalmente detrás de un balanceador."""
from __future__ import annotations

from typing import Callable, Optional, Protocol

from .domain import Cart, ConcurrencyError, ProductNotFound
from .repository import CartRepository


class Catalog(Protocol):
    def price_cents(self, sku: str) -> Optional[int]: ...


class InMemoryCatalog:
    def __init__(self, prices: dict[str, int]):
        self._prices = prices

    def price_cents(self, sku):
        return self._prices.get(sku)


class CartService:
    def __init__(self, repo: CartRepository, catalog: Catalog, max_retries: int = 8):
        self._repo, self._catalog, self._retries = repo, catalog, max_retries

    def get(self, cart_id: str) -> Cart:
        return self._repo.get(cart_id) or Cart(cart_id)

    def add_item(self, cart_id: str, sku: str, quantity: int = 1) -> Cart:
        # el precio lo pone el servidor; nunca se confía en el cliente
        price = self._catalog.price_cents(sku)
        if price is None:
            raise ProductNotFound(sku)
        return self._mutate(cart_id, lambda c: c.add_item(sku, quantity, price))

    def set_quantity(self, cart_id: str, sku: str, quantity: int) -> Cart:
        return self._mutate(cart_id, lambda c: c.set_quantity(sku, quantity))

    def remove_item(self, cart_id: str, sku: str) -> Cart:
        return self._mutate(cart_id, lambda c: c.remove_item(sku))

    def clear(self, cart_id: str) -> None:
        self._repo.delete(cart_id)

    def _mutate(self, cart_id: str, fn: Callable[[Cart], Cart]) -> Cart:
        """Leer → modificar → guardar con CAS; reintenta si otro escritor se adelantó."""
        for _ in range(self._retries):
            current = self._repo.get(cart_id) or Cart(cart_id)
            try:
                return self._repo.save(fn(current), expected_version=current.version)
            except ConcurrencyError:
                continue
        raise ConcurrencyError(f"demasiada contención en {cart_id}")
