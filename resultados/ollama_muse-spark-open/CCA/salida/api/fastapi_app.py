"""
API FastAPI (opcional, requiere `pip install fastapi uvicorn`).
Misma lógica que api/app.py pero con OpenAPI docs.

Ejecutar: uvicorn api.fastapi_app:app --reload
"""
try:
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel
    from decimal import Decimal
    from cart import (
        ShardedCartStorage, InMemoryInventory, CartService, EventBus,
        PricingEngine, BulkDiscountRule, CategoryDiscountRule, CouponDiscountRule,
        Coupon, CouponType, TaxCalculator, ShippingCalculator, Money
    )

    inventory = InMemoryInventory.with_sample_data()
    storage = ShardedCartStorage(num_shards=4)
    event_bus = EventBus()
    coupons = {
        "BIENVENIDO10": Coupon("BIENVENIDO10", CouponType.PERCENTAGE, Decimal("10"), min_purchase=Money(Decimal("30"))),
        "ENVIOGRATIS": Coupon("ENVIOGRATIS", CouponType.FREE_SHIPPING, Decimal("0")),
    }
    pricing = PricingEngine(
        rules=[
            BulkDiscountRule(product_id="P002", min_quantity=3, discount_percent=Decimal("15")),
            CouponDiscountRule(coupons=coupons),
        ],
        tax_calculator=TaxCalculator(default_rate=Decimal("0.21")),
        shipping_calculator=ShippingCalculator(free_shipping_threshold=Money(Decimal("50")), flat_rate=Money(Decimal("4.99")), free_shipping_coupons={"ENVIOGRATIS"})
    )
    service = CartService(storage=storage, inventory=inventory, pricing=pricing, event_bus=event_bus)

    app = FastAPI(title="Carrito Escalable API", version="1.0.0")

    class CreateCartReq(BaseModel):
        user_id: str | None = None
        currency: str = "EUR"

    class AddItemReq(BaseModel):
        product_id: str
        quantity: int = 1

    class UpdateQtyReq(BaseModel):
        quantity: int

    class CouponReq(BaseModel):
        code: str

    @app.post("/carts")
    def create_cart(req: CreateCartReq):
        return service.create_cart(user_id=req.user_id, currency=req.currency).to_dict()

    @app.get("/carts/{cart_id}")
    def get_cart(cart_id: str):
        try:
            cart = service.get_cart(cart_id)
            return {"cart": cart.to_dict(), "pricing": service.get_pricing(cart_id).to_dict()}
        except Exception as e:
            raise HTTPException(404, str(e))

    @app.post("/carts/{cart_id}/items")
    def add_item(cart_id: str, req: AddItemReq):
        try:
            return service.add_item(cart_id, req.product_id, req.quantity).to_dict()
        except Exception as e:
            raise HTTPException(400, str(e))

    @app.put("/carts/{cart_id}/items/{product_id}")
    def update_qty(cart_id: str, product_id: str, req: UpdateQtyReq):
        try:
            return service.update_quantity(cart_id, product_id, req.quantity).to_dict()
        except Exception as e:
            raise HTTPException(400, str(e))

    @app.delete("/carts/{cart_id}/items/{product_id}")
    def remove_item(cart_id: str, product_id: str):
        try:
            return service.remove_item(cart_id, product_id).to_dict()
        except Exception as e:
            raise HTTPException(400, str(e))

    @app.post("/carts/{cart_id}/coupon")
    def apply_coupon(cart_id: str, req: CouponReq):
        try:
            return service.apply_coupon(cart_id, req.code).to_dict()
        except Exception as e:
            raise HTTPException(400, str(e))

    @app.post("/carts/{cart_id}/checkout")
    def checkout(cart_id: str):
        try:
            return service.checkout(cart_id)
        except Exception as e:
            raise HTTPException(400, str(e))

    @app.get("/products")
    def list_products():
        return {k: v.to_dict() for k, v in inventory.list_products().items()}

except ImportError:
    pass  # fastapi no instalado, se usa api/app.py
