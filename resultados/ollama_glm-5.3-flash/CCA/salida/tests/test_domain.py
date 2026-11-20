from decimal import Decimal

import pytest

from cart.domain.exceptions import (
    CartCheckedOutError,
    DuplicateProductError,
    EmptyCartError,
    InvalidProductError,
    InvalidQuantityError,
    ItemLimitExceededError,
    ProductNotFoundInCartError,
    QuantityLimitExceededError,
)
from cart.domain.models import MAX_DISTINCT_ITEMS, MAX_QUANTITY_PER_LINE, Cart, CartStatus, Product


def make_product(price: str = "10.50", pid: str = "p1") -> Product:
    return Product(pid, "Widget", Decimal(price))


def test_product_validation():
    with pytest.raises(InvalidProductError):
        Product("", "name", Decimal("1"))
    with pytest.raises(InvalidProductError):
        Product("p1", "  ", Decimal("1"))
    with pytest.raises(InvalidProductError):
        Product("p1", "name", Decimal("-0.01"))
    product = make_product()
    assert product.to_dict()["price"] == "10.50"
    assert Product.from_dict(product.to_dict()) == product


def test_cart_items_missing():
    cart = Cart()
    assert cart.is_empty()
    assert cart.total() == Decimal("0")
    assert cart.item_count() == 0
    assert cart.total_units() == 0


def test_add_and_total():
    cart = Cart()
    cart.add_item(make_product("10.50", "p1"), 2)
    cart.add_item(make_product("3.25", "p2"), 1)
    assert cart.total() == Decimal("24.25")
    assert cart.version == 2
    assert cart.total_units() == 3


def test_duplicate_product_rejected():
    cart = Cart()
    cart.add_item(make_product(), 1)
    with pytest.raises(DuplicateProductError):
        cart.add_item(make_product(), 1)


def test_invalid_quantities():
    cart = Cart()
    for bad in (0, -1, 2.5, "3", True):
        with pytest.raises(InvalidQuantityError):
            cart.add_item(make_product(), bad)


def test_quantity_limit_per_line():
    cart = Cart()
    with pytest.raises(QuantityLimitExceededError):
        cart.add_item(make_product(), MAX_QUANTITY_PER_LINE + 1)


def test_item_limit():
    cart = Cart()
    for i in range(MAX_DISTINCT_ITEMS):
        cart.add_item(make_product("1.00", f"p{i}"), 1)
    assert cart.item_count() == MAX_DISTINCT_ITEMS
    with pytest.raises(ItemLimitExceededError):
        cart.add_item(make_product("1.00", "overflow"), 1)


def test_update_and_remove_and_clear():
    cart = Cart()
    cart.add_item(make_product("5.00", "p1"), 1)
    cart.update_quantity("p1", 4)
    assert cart.items["p1"].quantity == 4
    assert cart.total() == Decimal("20.00")
    cart.remove_item("p1")
    assert cart.is_empty()
    with pytest.raises(ProductNotFoundInCartError):
        cart.update_quantity("p1", 1)
    cart.add_item(make_product("5.00", "p2"), 2)
    cart.clear()
    assert cart.is_empty()
    with pytest.raises(ProductNotFoundInCartError):
        cart.remove_item("p2")


def test_checkout_flow():
    cart = Cart()
    with pytest.raises(EmptyCartError):
        cart.checkout()
    cart.add_item(make_product("7.00", "p1"), 3)
    cart.checkout()
    assert cart.status == CartStatus.CHECKED_OUT
    assert cart.total() == Decimal("21.00")
    with pytest.raises(CartCheckedOutError):
        cart.add_item(make_product("1.00", "p2"), 1)
    with pytest.raises(CartCheckedOutError):
        cart.checkout()


def test_serialization_roundtrip():
    cart = Cart("custom-id")
    cart.add_item(make_product("9.99", "p1"), 2)
    data = cart.to_dict()
    restored = Cart.from_dict(data)
    assert restored.id == "custom-id"
    assert restored.version == cart.version
    assert restored.status == cart.status
    assert restored.total() == cart.total()
    assert set(restored.items) == set(cart.items)
