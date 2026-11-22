"""python3 juez/juez.py <copia-de-salida>
Las pruebas de siempre del juez de CCA contra la librería:
  50 altas concurrentes (hilos) del mismo SKU en el mismo carrito, con un servicio y con dos servicios ("instancias")
  que comparten el mismo fichero SQLite; precio del cliente (la API no lo admite); cantidades raras; SKU con «../»;
  0,10 × 3; monedas mezcladas; mutar el carrito devuelto.
"""
import json, os, sys, tempfile, threading
sys.path.insert(0, os.path.abspath(sys.argv[1]))
from cart import (CartService, InMemoryCartRepository, InMemoryProductCatalog, Product, SKU, Money, PricingEngine)
from cart.infrastructure.repositories import SqliteCartRepository

catalog = InMemoryProductCatalog([Product(SKU("P1"), "Producto", Money.from_amount("10.00"), stock=1000),
                                  Product(SKU("P2"), "Céntimos", Money.from_amount("0.10"), stock=1000)])
out = {}

def intenta(f):
    try:
        return ["ok", f()]
    except Exception as e:  # noqa: BLE001
        return ["error", f"{type(e).__name__}: {e}"[:160]]

def cantidad(cart, sku="P1"):
    for it in getattr(cart, "items", []) or []:
        if str(getattr(it, "sku", getattr(getattr(it, "product", None), "sku", ""))) == sku:
            return int(getattr(it, "quantity", 0))
    return 0

def altas(servicios, cart_id):
    res = []
    def una(i):
        res.append(intenta(lambda: servicios[i % len(servicios)].add_item(cart_id, "P1", 1) and "ok"))
    hs = [threading.Thread(target=una, args=(i,)) for i in range(50)]
    [h.start() for h in hs]; [h.join() for h in hs]
    st = {}
    for k, v in res:
        key = k if k == "ok" else v.split(":")[0]
        st[key] = st.get(key, 0) + 1
    return st

s = CartService(repository=InMemoryCartRepository(), catalog=catalog, pricing_engine=PricingEngine())
c = s.create_cart()
out["una_instancia_memoria"] = {"resultados": altas([s], c.id), "guardadas": cantidad(s.get_cart(c.id))}

db = os.path.join(tempfile.mkdtemp(), "carts.db")
resolver = catalog.get
s1 = CartService(repository=SqliteCartRepository(db, resolver), catalog=catalog, pricing_engine=PricingEngine())
s2 = CartService(repository=SqliteCartRepository(db, resolver), catalog=catalog, pricing_engine=PricingEngine())
c = s1.create_cart()
out["dos_instancias_sqlite"] = {"resultados": altas([s1, s2], c.id), "guardadas": cantidad(s1.get_cart(c.id))}

c = s.create_cart()
out["precio_del_cliente"] = intenta(lambda: s.add_item(c.id, "P1", 1, price=0.01) and "aceptado")
for k, q in [("cantidad_0", 0), ("cantidad_negativa", -3), ("cantidad_decimal", 1.5), ("cantidad_enorme", 10**9), ("cantidad_texto", "2")]:
    out[k] = intenta(lambda q=q: s.add_item(c.id, "P1", q) and "aceptada")
out["sku_con_puntos"] = intenta(lambda: s.add_item(c.id, "../../etc/passwd", 1) and "aceptado")
out["cartId_con_puntos"] = intenta(lambda: s.get_cart("../../etc/passwd") and "encontrado")
out["cero_diez_por_tres"] = intenta(lambda: str(Money.from_amount("0.10") * 3))
out["monedas_mezcladas"] = intenta(lambda: str(Money.from_amount("1", "EUR") + Money.from_amount("1", "USD")))
c2 = s.create_cart(); s.add_item(c2.id, "P1", 2)
def mutar():
    a = s.get_cart(c2.id)
    antes = cantidad(a)
    try:
        for it in a.items:
            it.quantity = 999
    except Exception as e:  # noqa: BLE001
        return f"la línea no se deja mutar: {type(e).__name__}"
    return f"antes {antes}; tras mutar el objeto devuelto y releer: {cantidad(s.get_cart(c2.id))}"
out["mutar"] = intenta(mutar)
print(json.dumps(out, ensure_ascii=False, indent=1))
