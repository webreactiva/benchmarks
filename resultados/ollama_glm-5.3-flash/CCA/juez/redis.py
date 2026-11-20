# /tmp/rv/bin/python juez/redis.py  (con redis y fakeredis instalados, desde la copia de salida/)
import fakeredis
from cart.infrastructure.redis_repository import RedisCartRepository
from cart.domain.models import Cart
r = RedisCartRepository(fakeredis.FakeRedis())
try: r.update('no-existe', lambda c: None)
except Exception as e: print('carrito inexistente →', type(e).__name__, e)
c = Cart(); r.create(c); r.update(c.id, lambda x: None); print('update normal ok')
