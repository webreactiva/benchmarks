# Script del juez (no del modelo). Se ejecuta desde una copia de salida/ (sin __pycache__):
#   cd /tmp/cca-sonnet && python3 <ruta>/juez/juez.py            # memoria
#   /tmp/cca-venv/bin/python <ruta>/juez/juez.py 6390            # + Redis real (redis-server local, pip install redis en un venv)
import sys, os, json, threading, http.client
sys.path.insert(0, os.getcwd())
from http.server import ThreadingHTTPServer
from cart import *
from cart.api import make_handler

PRECIOS = {**{f"p{i}": 100 for i in range(50)}, "dec": 10, "a": 1000}

def alta50(svc, cart, mismo):
    errs = []
    def f(i):
        try: svc[i % len(svc)].add_item(cart, "a" if mismo else f"p{i}", 1)
        except Exception as e: errs.append(type(e).__name__)
    th = [threading.Thread(target=f, args=(i,)) for i in range(50)]
    [t.start() for t in th]; [t.join() for t in th]
    c = svc[0].get(cart)
    return c.item_count, len(c.items), errs

def pruebas(nombre, repos):
    svc = [CartService(r, InMemoryCatalog(PRECIOS)) for r in repos]
    u, l, e = alta50(svc, f"{nombre}-distintos", False)
    print(f"[{nombre}] 50 altas a la vez, 50 productos, {len(svc)} servicio(s): unidades {u}, líneas {l}, errores {len(e)} {sorted(set(e))}")
    u, l, e = alta50(svc, f"{nombre}-mismo", True)
    print(f"[{nombre}] 50 altas a la vez, mismo producto: cantidad {u}, errores {len(e)} {sorted(set(e))}")

repo = InMemoryCartRepository()
pruebas("memoria", [repo])
s = CartService(repo, InMemoryCatalog(PRECIOS))
print("0,10 × 3 =", s.add_item("dec3", "dec", 3).total_cents, "céntimos")
print("moneda: el catálogo solo da price_cents; el carrito es", Cart("x").currency, "fijo (no hay forma de meter USD)")
try: c = s.add_item("../fuera", "a", 1); print("id ../fuera en el servicio: ACEPTADO, guardado como", repr(c.id))
except Exception as e: print("id ../fuera en el servicio: rechazado", type(e).__name__)
for q in (0, -1, 1.5, True, "2", 10**9):
    try: s.add_item("val", "a", q); print(f"cantidad {q!r}: ACEPTADA")
    except Exception as e: print(f"cantidad {q!r}: rechazada {type(e).__name__}")
c = s.add_item("mut", "a", 1)
try:
    c.items["a"] = CartItem("a", 500, 1); print("objeto devuelto: items se puede mutar → en el almacén", s.get("mut").items["a"].quantity, "unidades")
except Exception as e: print("objeto devuelto: inmutable", type(e).__name__)
c = s.get("mut")
try:
    c.items.clear(); print("get() devuelto, items.clear() → en el almacén", len(s.get("mut").items), "líneas")
except Exception as e: print("get(): inmutable", type(e).__name__)

# HTTP
srv = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(CartService(InMemoryCartRepository(), InMemoryCatalog(PRECIOS))))
threading.Thread(target=srv.serve_forever, daemon=True).start()
port = srv.server_address[1]
def req(p, m, path, body=None):
    h = http.client.HTTPConnection("127.0.0.1", p); h.request(m, path, json.dumps(body) if body is not None else None, {"Content-Type": "application/json"})
    r = h.getresponse(); d = r.read(); return r.status, (json.loads(d) if d else None)
st, d = req(port, "POST", "/carts/h1/items", {"sku": "a", "quantity": 1, "unit_price_cents": 1})
print("HTTP precio desde el cliente (1 ¢):", st, "total", d["total_cents"])
print("HTTP /carts/../items:", req(port, "POST", "/carts/../items", {"sku": "a"})[0])
print("HTTP /carts/%2E%2E/items:", req(port, "POST", "/carts/%2E%2E/items", {"sku": "a"})[0])
print("HTTP cantidad -3:", req(port, "POST", "/carts/h1/items", {"sku": "a", "quantity": -3}))
res = []
th = [threading.Thread(target=lambda i=i: res.append(req(port, "POST", "/carts/h50/items", {"sku": f"p{i}"})[0])) for i in range(50)]
[t.start() for t in th]; [t.join() for t in th]
st, d = req(port, "GET", "/carts/h50")
print("HTTP 50 POST a la vez:", {k: res.count(k) for k in set(res)}, "→ líneas", len(d["items"]))

if len(sys.argv) > 1:
    import redis
    from cart.repository import RedisCartRepository  # no se exporta en cart/__init__.py
    port_r = int(sys.argv[1])
    redis.Redis(port=port_r).flushall()
    mk = lambda: RedisCartRepository(redis.Redis(port=port_r))
    pruebas("redis", [mk()])
    pruebas("redis, 2 instancias", [mk(), mk()])
    # dos servidores HTTP sobre el mismo Redis
    ps = []
    for _ in range(2):
        sv = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(CartService(mk(), InMemoryCatalog(PRECIOS))))
        threading.Thread(target=sv.serve_forever, daemon=True).start(); ps.append(sv.server_address[1])
    res = []
    th = [threading.Thread(target=lambda i=i: res.append(req(ps[i % 2], "POST", "/carts/r50/items", {"sku": f"p{i}"})[0])) for i in range(50)]
    [t.start() for t in th]; [t.join() for t in th]
    st, d = req(ps[1], "GET", "/carts/r50")
    print("HTTP 2 instancias + Redis, 50 POST a la vez:", {k: res.count(k) for k in set(res)}, "→ líneas", len(d["items"]), "versión", d["version"])
    req(ps[0], "DELETE", "/carts/r50"); print("tras DELETE en una instancia, la otra ve", len(req(ps[1], "GET", "/carts/r50")[1]["items"]), "líneas")
    r = redis.Redis(port=port_r); print("TTL en Redis de cart:{h}:data:", r.ttl(f"cart:{{redis-mismo}}:data"), "s")
