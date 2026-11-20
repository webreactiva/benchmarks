#!/usr/bin/env python3
"""
Demo completa del carrito escalable.

Ejecuta: python main.py
"""
from decimal import Decimal
from cart import (
    ShardedCartStorage, InMemoryInventory, CartService, EventBus,
    PricingEngine, BulkDiscountRule, CategoryDiscountRule, CouponDiscountRule,
    Coupon, CouponType, TaxCalculator, ShippingCalculator, Money
)

def demo():
    print("🛒 === Carrito de la Compra Escalable - DEMO ===\n")

    # 1. Infraestructura
    inventory = InMemoryInventory.with_sample_data()
    storage = ShardedCartStorage(num_shards=4)
    bus = EventBus()

    bus.subscribe_all(lambda e: print(f"  📢 Evento: {e.type.value} | cart={e.cart_id[:8]} | {e.payload}"))

    coupons = {
        "BIENVENIDO10": Coupon("BIENVENIDO10", CouponType.PERCENTAGE, Decimal("10"), min_purchase=Money(Decimal("30"))),
        "LIBROS20": Coupon("LIBROS20", CouponType.PERCENTAGE, Decimal("20"), applicable_categories=["books"]),
        "FIJO5": Coupon("FIJO5", CouponType.FIXED, Decimal("5"), min_purchase=Money(Decimal("20"))),
        "ENVIOGRATIS": Coupon("ENVIOGRATIS", CouponType.FREE_SHIPPING, Decimal("0")),
    }

    pricing = PricingEngine(
        rules=[
            BulkDiscountRule(product_id="P002", min_quantity=3, discount_percent=Decimal("15")),
            CategoryDiscountRule(category="books", discount_percent=Decimal("10")),
            CouponDiscountRule(coupons=coupons),
        ],
        tax_calculator=TaxCalculator(default_rate=Decimal("0.21"), category_rates={"books": Decimal("0.04"), "apparel": Decimal("0.21")}),
        shipping_calculator=ShippingCalculator(
            free_shipping_threshold=Money(Decimal("50")),
            flat_rate=Money(Decimal("4.99")),
            free_shipping_coupons={"ENVIOGRATIS"}
        )
    )

    service = CartService(storage=storage, inventory=inventory, pricing=pricing, event_bus=bus)

    # 2. Productos disponibles
    print("📦 Productos disponibles:")
    for p in inventory.list_products().values():
        print(f"  {p.id}: {p.name} - {p.price} (stock {p.stock}, cat:{p.category})")
    print()

    # 3. Crear carrito para usuario
    cart = service.create_cart(user_id="user-123")
    print(f"✅ Carrito creado: {cart.id} para user-123 (shard {storage._shard_index(cart.id)})")
    print(f"   Total carritos en sistema: {storage.count()}")
    print()

    # 4. Añadir items
    print("➕ Añadiendo items...")
    service.add_item(cart.id, "P001", 1)  # Laptop 999.99
    print("  + 1x Laptop Pro")
    service.add_item(cart.id, "P002", 3)  # Ratón x3 -> bulk discount
    print("  + 3x Ratón Inalámbrico (activa bulk 15%)")
    service.add_item(cart.id, "P006", 2)  # Libro x2 -> category discount
    print("  + 2x Libro Python (activa 10% categoría libros)")
    service.add_item(cart.id, "P004", 1)  # Camiseta
    print("  + 1x Camiseta")

    cart = service.get_cart(cart.id)
    print(f"\n  Carrito: {cart.total_items} unidades, {cart.total_unique_items} únicos")
    print(f"  Subtotal sin descuentos: {cart.subtotal}")

    # 5. Pricing sin cupón
    breakdown = service.get_pricing(cart.id)
    print("\n💰 Desglose SIN cupón:")
    print(f"  Subtotal: {breakdown.subtotal}")
    for name, disc in breakdown.discounts.items():
        print(f"  Descuento {name}: -{disc}")
    print(f"  Total descuento: -{breakdown.total_discount}")
    print(f"  Tras descuentos: {breakdown.after_discount}")
    print(f"  IVA: +{breakdown.tax}")
    print(f"  Envío: +{breakdown.shipping}")
    print(f"  ➡️ TOTAL: {breakdown.total}")

    # 6. Aplicar cupón
    print("\n🏷️ Aplicando cupón BIENVENIDO10 (10% sobre >30€)...")
    service.apply_coupon(cart.id, "BIENVENIDO10")
    breakdown = service.get_pricing(cart.id)
    print(f"  Descuentos totales: {breakdown.discounts}")
    print(f"  Total con cupón: {breakdown.total} (antes {breakdown.subtotal})")

    # 7. Actualizar cantidad
    print("\n🔄 Actualizando cantidad P002 -> 5 unidades")
    service.update_quantity(cart.id, "P002", 5)
    cart = service.get_cart(cart.id)
    print(f"  Nuevo total items: {cart.total_items}")
    print(f"  Nuevo pricing total: {service.get_pricing(cart.id).total}")

    # 8. Demo de escalabilidad: sharding
    print("\n📊 Demo sharding - creando 20 carritos...")
    for i in range(20):
        c = service.create_cart(user_id=f"user-{i%3}")
        service.add_item(c.id, "P004", 1)
    print(f"  Total carritos: {storage.count()}")
    print(f"  Distribución por shard: {storage.shard_stats()}")
    # Ideal balanceado ~5 por shard

    # 9. Concurrencia
    print("\n⚡ Demo concurrencia - 10 hilos añadiendo al mismo carrito...")
    import threading
    concurrent_cart = service.create_cart(user_id="concurrent-user")
    # Usar producto con stock alto
    def add_concurrent():
        try:
            service.add_item(concurrent_cart.id, "P002", 1)
        except Exception as e:
            print(f"    hilo error: {e}")

    threads = [threading.Thread(target=add_concurrent) for _ in range(10)]
    for t in threads: t.start()
    for t in threads: t.join()
    cc = service.get_cart(concurrent_cart.id)
    print(f"  Resultado: {cc.total_items} items (esperado 10) - version {cc.version}")

    # 10. Checkout
    print(f"\n💳 Checkout carrito {cart.id[:8]}...")
    result = service.checkout(cart.id)
    print(f"  Order ID: {result['order_id']}")
    print(f"  Total pagado: {result['pricing']['total']}")
    print(f"  Estado carrito: {result['cart']['status']}")

    # Verificar stock reducido
    laptop = inventory.get_product("P001")
    print(f"\n  Stock Laptop tras checkout: {laptop.stock} (antes 50, vendido 1)")

    # 11. Limpieza expirados
    print("\n🧹 Limpieza de expirados...")
    removed = storage.clear_expired()
    print(f"  Eliminados: {removed}")

    print("\n✅ Demo completada. Ver README.md para arquitectura escalable.")
    print("\n💡 Para API REST: python -m api.app  -> http://localhost:8000")

if __name__ == "__main__":
    demo()
