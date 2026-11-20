from decimal import Decimal

import pytest

from cart.application.services import CartService
from cart.domain.events import CartEvent
from cart.domain.exceptions import (
    CartCheckedOutError,
    CartNotFoundError,
    DuplicateProductError,
    InvalidProductError,
    InvalidQuantityError,
    ProductNotFoundError,
)
from cart.infrastructure.memory import (
    InMemoryCartRepository,
    InMemoryEventPublisher,
    InMemoryProductRepository,
)


class RecordingPublisher:
    def __init__(self) -> None:
        self.events: list[CartEvent] = []

    def publish(self, event: CartEvent) -> None:
        self.events.append(event)


@pytest.fixture()
def service():
    return CartService(InMemoryCartRepository(), InMemoryProductRepository(), RecordingPublisher())


def product(service, pid="p1", price="10.00"):
    return service.create_product("Widget", price, pid)


def test_create_product(service):
    created = service.create_product("Thing", "19.99")
    assert created.id
    assert created.price == Decimal("19.99")
    with pytest.raises(DuplicateProductError):
        service.create_product("Again", "1.00", created.id)


def test_product_validation_and_errors(service):
    with pytest.raises(InvalidProductError):
        service.create_product("Bad", "not-a-number")
    product(service, "p1")
    with pytest.raises(ProductNotFoundError):
        service.get_product("missing")
    listing = service.list_products()
    assert len(listing) == 1


def test_cart_flow_and_events(service):
    snapshot = service.create_cart()
    cart_id = snapshot["id"]
    product(service, "p1", "12.50")
    events = [e.type for e in service._publisher.events]
    assert events == ["cart.created"]

    updated = service.add_item(cart_id, "p1", 2)
    assert updated["total"] == "25.00"
    assert [e.type for e in service._publisher.events] == ["cart.created", "cart.item_added"]

    updated = service.update_item(cart_id, "p1", 3)
    assert updated["total"] == "37.50"
    updated = service.remove_item(cart_id, "p1")
    assert updated["item_count"] == 0
    cleared = service.clear_cart(cart_id)
    assert cleared["item_count"] == 0

    types = [e.type for e in service._publisher.events]
    assert types == [
        "cart.created",
        "cart.item_added",
        "cart.quantity_updated",
        "cart.item_removed",
        "cart.cleared",
    ]


def test_add_item_errors(service):
    snapshot = service.create_cart()
    cart_id = snapshot["id"]
    product(service, "p1")
    with pytest.raises(ProductNotFoundError):
        service.add_item(cart_id, "ghost", 1)
    with pytest.raises(CartNotFoundError):
        service.add_item("ghost", "p1", 1)
    with pytest.raises(InvalidQuantityError):
        service.add_item(cart_id, "p1", 0)
    service.add_item(cart_id, "p1", 1)
    with pytest.raises(DuplicateProductError):
        service.add_item(cart_id, "p1", 1)


def test_checkout_publishes_total(service):
    cart_id = service.create_cart()["id"]
    product(service, "p1", "5.25")
    product(service, "p2", "1.25")
    service.add_item(cart_id, "p1", 4)
    service.add_item(cart_id, "p2", 1)
    snapshot = service.checkout_cart(cart_id)
    assert snapshot["status"] == "checked_out"
    assert snapshot["total"] == "22.25"
    with pytest.raises(CartCheckedOutError):
        service.checkout_cart(cart_id)
    last = service._publisher.events[-1]
    assert last.type == "cart.checked_out"
    assert last.payload["total"] == "22.25"


def test_unknown_cart(service):
    with pytest.raises(CartNotFoundError):
        service.get_cart("nope")
    with pytest.raises(CartNotFoundError):
        service.delete_cart("nope")
