import threading

import pytest

from cart.application.services import CartService
from cart.domain.events import CartEvent
from cart.domain.exceptions import CartCheckedOutError, DuplicateProductError
from decimal import Decimal

from cart.domain.models import Cart, Product
from cart.infrastructure.memory import InMemoryCartRepository, InMemoryEventPublisher, InMemoryProductRepository


def test_per_cart_serialized_updates():
    repo = InMemoryCartRepository()
    repo.create(Cart("cart-1"))
    repo.update("cart-1", lambda cart: cart.add_item(Product("p1", "Widget", Decimal("1.00")), 1))
    repo.update("cart-1", lambda cart: cart.add_item(Product("p2", "Gadget", Decimal("1.00")), 1))

    def bump(product_id: str):
        def mutator(cart) -> None:
            item = cart.items[product_id]
            cart.items[product_id] = item.with_quantity(item.quantity + 1)
            cart.version += 1

        return mutator

    total_updates = 500
    threads = [
        threading.Thread(target=lambda: repo.update("cart-1", bump("p1"))) for _ in range(total_updates)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    cart = repo.get("cart-1")
    assert cart.items["p1"].quantity == 1 + total_updates
    assert cart.items["p2"].quantity == 1
    assert cart.version == 2 + total_updates


def test_concurrent_checkout_only_one_succeeds():
    service = CartService(InMemoryCartRepository(), InMemoryProductRepository())
    service.create_product("Widget", "1.00", "p1")
    cart_id = service.create_cart()["id"]
    service.add_item(cart_id, "p1", 1)

    workers = 8
    barrier = threading.Barrier(workers)
    successes = []
    failures = []
    lock = threading.Lock()

    def worker() -> None:
        barrier.wait()
        try:
            service.checkout_cart(cart_id)
            with lock:
                successes.append(1)
        except CartCheckedOutError:
            with lock:
                failures.append(1)

    threads = [threading.Thread(target=worker) for _ in range(workers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert len(successes) == 1
    assert len(failures) == workers - 1
    assert service.get_cart(cart_id)["status"] == "checked_out"


def test_product_repository_thread_safety():
    repo = InMemoryProductRepository()
    errors = []

    def add_one(index: int) -> None:
        try:
            repo.add(Product(f"p{index}", f"name-{index}", Decimal(1)))
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=add_one, args=(i,)) for i in range(100)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert not errors
    assert len(repo.list(limit=1_000)) == 100


def test_product_repository_duplicates_and_delete():
    repo = InMemoryProductRepository()
    repo.add(Product("p1", "Widget", Decimal("1.00")))
    with pytest.raises(DuplicateProductError):
        repo.add(Product("p1", "Widget", Decimal("1.00")))
    assert repo.get("p1").name == "Widget"
    repo.delete("p1")
    assert repo.list() == []


def test_event_publisher_multicast_and_unsubscribe():
    publisher = InMemoryEventPublisher()
    received_a: list[CartEvent] = []
    received_b: list[CartEvent] = []
    unsubscribe_a = publisher.subscribe(received_a.append)
    publisher.subscribe(received_b.append)

    first = CartEvent("cart.created", "cart-1")
    publisher.publish(first)
    assert received_a == [first]
    assert received_b == [first]

    unsubscribe_a()
    second = CartEvent("cart.checked_out", "cart-1", {"total": "10.00"})
    publisher.publish(second)
    assert received_a == [first]
    assert received_b == [first, second]
