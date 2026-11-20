import threading
from tests.test_cart import make_service
svc, storage, inv, _ = make_service(num_shards=4, reserve=False)
cart = svc.create_cart(); errs = []
prods = ["P001", "P002", "P003", "P004"]
def alta(i):
    try: svc.add_item(cart.id, prods[i % 4], 1)
    except Exception as e: errs.append(type(e).__name__ + ": " + str(e)[:60])
th = [threading.Thread(target=alta, args=(i,)) for i in range(50)]
[t.start() for t in th]; [t.join() for t in th]
print("50 hilos, 4 productos, almacenamiento con 4 shards: unidades", svc.get_cart(cart.id).total_items, "| errores", errs[:3])
# precio desde el cliente: add_item no acepta precio (firma)
import inspect; print("firma add_item:", inspect.signature(svc.add_item))
