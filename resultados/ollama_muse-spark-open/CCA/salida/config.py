"""
Configuración centralizada (12-factor app).
"""
import os
from decimal import Decimal

class Settings:
    STORAGE_TYPE = os.getenv("CART_STORAGE", "memory")  # memory | sharded | file | redis
    NUM_SHARDS = int(os.getenv("CART_SHARDS", "4"))
    MAX_UNIQUE_ITEMS = int(os.getenv("CART_MAX_UNIQUE", "100"))
    MAX_QTY_PER_ITEM = int(os.getenv("CART_MAX_QTY", "99"))
    CART_TTL_DAYS = int(os.getenv("CART_TTL_DAYS", "7"))
    DEFAULT_CURRENCY = os.getenv("CART_CURRENCY", "EUR")
    DEFAULT_TAX_RATE = Decimal(os.getenv("CART_TAX_RATE", "0.21"))
    FREE_SHIPPING_THRESHOLD = Decimal(os.getenv("CART_FREE_SHIPPING", "50"))
    SHIPPING_FLAT_RATE = Decimal(os.getenv("CART_SHIPPING_RATE", "4.99"))
    RESERVE_STOCK = os.getenv("CART_RESERVE_STOCK", "true").lower() == "true"

    @classmethod
    def dump(cls):
        return {k: getattr(cls, k) for k in dir(cls) if not k.startswith("_") and k.isupper()}

settings = Settings()
