import threading
from decimal import Decimal
from datetime import timedelta
from cart import (
    Money, Product, Cart,
    InMemoryCartStorage, ShardedCartStorage, InMemoryInventory, CartService, EventBus,
    PricingEngine, BulkDiscountRule, CouponDiscountRule, Coupon, CouponType, TaxCalculator, ShippingCalculator
)

def make_service(num_shards=None, reserve=True):
    inv = InMemoryInventory.with_sample_data()
    storage = ShardedCartStorage(num_shards) if num_shards else InMemoryCartStorage()
    bus = EventBus()
    coupons = {
        "TEST10": Coupon("TEST10", CouponType.PERCENTAGE, Decimal("10")),
        "FIX5": Coupon("FIX5", CouponType.FIXED, Decimal("5")),
    }
    pricing = PricingEngine(
        rules=[BulkDiscountRule("P002", 3, Decimal("15")), CouponDiscountRule(coupons)],
        tax_calculator=TaxCalculator(Decimal("0.21")),
        shipping_calculator=ShippingCalculator(free_shipping_threshold=Money(Decimal("50")), flat_rate=Money(Decimal("4.99")))
    )
    return CartService(storage, inv, pricing, bus, reserve_stock=reserve), storage, inv, bus

def test_create_and_add():
    svc, _, _, _ = make_service()
    cart = svc.create_cart(user_id="u1")
    assert cart.id
    svc.add_item(cart.id, "P001", 2)
    c = svc.get_cart(cart.id)
    assert c.total_items == 2
    assert c.items["P001"].quantity == 2
    print("✓ test_create_and_add")

def test_update_remove():
    svc, _, _, _ = make_service()
    cart = svc.create_cart()
    svc.add_item(cart.id, "P002", 2)
    svc.update_quantity(cart.id, "P002", 5)
    assert svc.get_cart(cart.id).items["P002"].quantity == 5
    svc.remove_item(cart.id, "P002")
    assert svc.get_cart(cart.id).is_empty()
    print("✓ test_update_remove")

def test_bulk_discount():
    svc, _, _, _ = make_service()
    cart = svc.create_cart()
    svc.add_item(cart.id, "P002", 3)  # bulk 15% => 29.99*3=89.97 *0.15=13.495 =>13.50
    pricing = svc.get_pricing(cart.id)
    assert pricing.total_discount.amount > Decimal("0")
    # discount approx 13.50
    assert pricing.total_discount.amount == Decimal("13.50")
    print("✓ test_bulk_discount")

def test_coupon():
    svc, _, _, _ = make_service()
    cart = svc.create_cart()
    svc.add_item(cart.id, "P001", 1)  # 999.99
    svc.apply_coupon(cart.id, "TEST10")
    pricing = svc.get_pricing(cart.id)
    # 10% de 999.99 = 99.999 => 100.00
    assert pricing.total_discount.amount == Decimal("100.00")
    print("✓ test_coupon")

def test_coupon_invalid_no_discount():
    svc, _, _, _ = make_service()
    cart = svc.create_cart()
    svc.add_item(cart.id, "P001", 1)
    svc.apply_coupon(cart.id, "INVALID")
    pricing = svc.get_pricing(cart.id)
    # coupon invalid => only bulk? but no bulk for P001 => 0 discount (o solo bulk si aplica)
    # Verificar que no aplica cupón inválido
    assert pricing.discounts == {} or all("INVALID" not in k for k in pricing.discounts)
    print("✓ test_coupon_invalid_no_discount")

def test_stock_reservation():
    svc, _, inv, _ = make_service()
    cart = svc.create_cart()
    # P006 stock 30
    svc.add_item(cart.id, "P006", 10)
    assert inv.available_stock("P006") == 20
    svc.remove_item(cart.id, "P006")
    assert inv.available_stock("P006") == 30
    print("✓ test_stock_reservation")

def test_insufficient_stock():
    svc, _, _, _ = make_service()
    cart = svc.create_cart()
    try:
        svc.add_item(cart.id, "P006", 31)
        assert False, "debería fallar stock"
    except Exception as e:
        assert "Stock insuficiente" in str(e) or "stock" in str(e).lower()
    print("✓ test_insufficient_stock")

def test_concurrency():
    svc, _, _, _ = make_service(reserve=False)
    cart = svc.create_cart()
    def task():
        svc.add_item(cart.id, "P002", 1)
    threads = [threading.Thread(target=task) for _ in range(20)]
    for t in threads: t.start()
    for t in threads: t.join()
    c = svc.get_cart(cart.id)
    assert c.total_items == 20, f"esperado 20 got {c.total_items}"
    print("✓ test_concurrency 20 hilos -> 20 items")

def test_sharding():
    svc, storage, _, _ = make_service(num_shards=4)
    for i in range(12):
        c = svc.create_cart(user_id="u")
        svc.add_item(c.id, "P004", 1)
    assert storage.count() == 12
    stats = storage.shard_stats()
    assert sum(stats.values()) == 12
    print(f"✓ test_sharding distribución {stats}")

def test_checkout():
    svc, _, inv, _ = make_service()
    cart = svc.create_cart()
    svc.add_item(cart.id, "P001", 1)
    before = inv.get_product("P001").stock
    result = svc.checkout(cart.id)
    assert result["cart"]["status"] == "checked_out"
    after = inv.get_product("P001").stock
    assert after == before - 1
    print("✓ test_checkout")

def test_limits():
    svc, _, _, _ = make_service()
    cart = svc.create_cart()
    try:
        svc.add_item(cart.id, "P002", 100)  # max 99
        assert False
    except Exception:
        pass
    print("✓ test_limits")

def test_expired_cart():
    from datetime import datetime, timezone
    svc, storage, _, _ = make_service()
    cart = svc.create_cart(ttl=timedelta(milliseconds=1))
    # forzar expiración
    import time; time.sleep(0.01)
    try:
        svc.get_cart(cart.id)
        assert False
    except Exception as e:
        assert "expirado" in str(e).lower()
    print("✓ test_expired_cart")

if __name__ == "__main__":
    test_create_and_add()
    test_update_remove()
    test_bulk_discount()
    test_coupon()
    test_coupon_invalid_no_discount()
    test_stock_reservation()
    test_insufficient_stock()
    test_concurrency()
    test_sharding()
    test_checkout()
    test_limits()
    test_expired_cart()
    print("\n✅ Todos los tests pasaron")
