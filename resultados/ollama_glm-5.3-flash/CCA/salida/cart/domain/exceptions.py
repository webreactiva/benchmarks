from __future__ import annotations


class CartError(Exception):
    code = "cart_error"
    http_status = 400

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class CartNotFoundError(CartError):
    code = "cart_not_found"
    http_status = 404


class DuplicateCartError(CartError):
    code = "duplicate_cart"
    http_status = 409


class ProductNotFoundError(CartError):
    code = "product_not_found"
    http_status = 404


class DuplicateProductError(CartError):
    code = "duplicate_product"
    http_status = 409


class InvalidProductError(CartError):
    code = "invalid_product"
    http_status = 400


class InvalidQuantityError(CartError):
    code = "invalid_quantity"
    http_status = 400


class QuantityLimitExceededError(CartError):
    code = "quantity_limit_exceeded"
    http_status = 400


class ItemLimitExceededError(CartError):
    code = "item_limit_exceeded"
    http_status = 400


class ProductNotFoundInCartError(CartError):
    code = "item_not_in_cart"
    http_status = 404


class EmptyCartError(CartError):
    code = "empty_cart"
    http_status = 409


class CartCheckedOutError(CartError):
    code = "cart_already_checked_out"
    http_status = 409
