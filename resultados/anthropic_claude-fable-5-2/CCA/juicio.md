# CCA · claude-fable-5-2 · 10/10

**Escala de verdad, sin adornos.** Servicio sin estado con los carritos en Redis y cada escritura atómica en un script Lua; el dominio es el mínimo que pide el prompt.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| se ejecuta | 1 |
| tests en verde | 1 |
| dominio completo | 1 |
| dinero exacto | 1 |
| precio del catálogo y validación | 1 |
| concurrencia | 2 |
| escala horizontal | 2 |
| explica el escalado | 1 |
| **Total** | **10** |

## Validación
- En una copia sin `node_modules`: `npm ci` (solo `ioredis`) y `npm start`. `npm test`: 13/13 con el almacén en memoria (uno saltado, el de Redis) y 21/21 con `REDIS_URL` contra un `redis-server` local.
- `juez/juez.mjs`, con cuatro instancias: dos en memoria y dos con el mismo Redis.
  - 50 altas a la vez del mismo SKU: 50 guardadas en una instancia (memoria o Redis) y 50 repartidas entre las dos instancias con Redis.
  - Sin Redis, dos instancias reparten el carrito en 25 y 25: cada una tiene su memoria. El README dice que ese modo es solo para desarrollo.
  - El precio mandado por el cliente se ignora: guarda 9,50 € del catálogo.
  - Cantidad 0, negativa, decimal, mil millones o en texto → 400; SKU inexistente → 404; SKU `../../etc/passwd` → 400; cartId y SKU con `../` en la ruta → 404; cuerpo vacío o que no es JSON → 400.
  - 0,10 × 3 y mezclar monedas no aplican: todo son enteros en céntimos y el catálogo tiene una sola moneda.
  - Fijar cantidad, quitar y vaciar funcionan. Cada respuesta es JSON nuevo: mutarla no cambia el carrito.

## Lo que está bien
- Concurrencia resuelta donde tiene que estar: cada alta o cambio es un único script Lua sobre un hash por carrito, sin leer-modificar-escribir en la aplicación. Los límites de líneas y de unidades se comprueban dentro del mismo script.
- Escala horizontal real: los procesos no guardan nada, el almacenamiento compartido es Redis y funciona con dos instancias. Las claves llevan la etiqueta `{cartId}` para Redis Cluster y caducan con TTL.
- El carrito solo guarda SKU y cantidad; nombre y precio se resuelven en el catálogo al leer.
- `Idempotency-Key` en el alta para que un reintento no sume dos veces.
- README corto y concreto: API, configuración, por qué escala y lo que queda fuera (autenticación, catálogo real, stock, impuestos, checkout).

## Lo que falta o está mal
- El dominio es el justo: sin stock, descuentos, impuestos ni checkout. Lo dice, y la rúbrica no lo pide, pero otros modelos dieron bastante más.
- Sin tipo `Money`: los importes son números enteros sueltos y la moneda es una por catálogo. Es exacto, pero nada impide mezclar monedas si el catálogo creciera.
- La clave de idempotencia no se compara con el cuerpo: reutilizarla con otro producto se trata como repetición (el README lo avisa).
- Entrega `node_modules` en la carpeta.

## Rarezas de la sesión
- Miró qué había en la máquina, vio `redis-server` y lo arrancó para probar contra un Redis real en vez de quedarse con la memoria.
- Los 21 tests pasaron a la primera, sin tocar nada. Después levantó dos réplicas contra el mismo Redis y comprobó con curl que 40 altas repartidas dejaban 40.
- Dice que no ha probado el Dockerfile ni el docker-compose.
- 3 minutos y 6 peticiones: 20 000 tokens de salida y 295 000 en total (245 000 de caché).
