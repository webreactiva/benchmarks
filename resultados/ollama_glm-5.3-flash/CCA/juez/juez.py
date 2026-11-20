import threading
from decimal import Decimal
from cart.infrastructure.memory import build_in_memory_service
r = build_in_memory_service()
svc = r[0] if isinstance(r, tuple) else r
ps = [svc.create_product(f"p{i}", "1.00") for i in range(50)]
c = svc.create_cart()["id"]
th = [threading.Thread(target=svc.add_item, args=(c, p.id, 1)) for p in ps]
[t.start() for t in th]; [t.join() for t in th]
print("concurrencia: 50 hilos, líneas guardadas", len(svc.get_cart(c)["items"]))
d = svc.create_product("dec", "0.10"); c2 = svc.create_cart()["id"]; s = svc.add_item(c2, d.id, 3)
print("0,10 × 3 =", s.get("subtotal") or s.get("total"))
snap = svc.get_cart(c2); snap["items"].clear(); print("tras tocar el snapshot, líneas", len(svc.get_cart(c2)["items"]))
try: svc.create_product("neg", "-5"); print("precio negativo ACEPTADO")
except Exception as e: print("precio negativo rechazado:", type(e).__name__)
try: svc.add_item(c2, d.id, 10**9); print("cantidad 1e9 ACEPTADA")
except Exception as e: print("cantidad 1e9 rechazada:", type(e).__name__)
