import threading
from decimal import Decimal
from models.carrito import Carrito
from models.producto import Producto
from service.producto_service import ProductoService
s = ProductoService([Producto(id=f"p{i}", nombre="x", precio=Decimal("1.00"), moneda="EUR", stock=1000) for i in range(50)]
                   + [Producto(id="usd", nombre="y", precio=Decimal("1.00"), moneda="USD", stock=10), Producto(id="dec", nombre="z", precio=Decimal("0.10"), moneda="EUR", stock=10)])
c = Carrito(s)
th = [threading.Thread(target=c.agregar_producto, args=(f"p{i}", 1)) for i in range(50)]
[t.start() for t in th]; [t.join() for t in th]
print("50 hilos: líneas", len(c.obtener_items()))
try: c.agregar_producto("usd", 1); print("USD en carrito EUR: ACEPTADO")
except Exception as e: print("USD en carrito EUR: rechazado", type(e).__name__)
c2 = Carrito(s); c2.agregar_producto("dec", 3); print("0,10 × 3 =", c2.calcular_total())
