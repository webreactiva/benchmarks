Dominio, motor de precios, repositorios (memoria y Redis) y servicio listos; ahora escribo la API HTTP, el arranque y los tests.

---

Encontrado un bug real: `save` del repositorio en memoria tenía un `await` entre la comprobación de versión y la escritura, así que el compare-and-set no era atómico. Lo corrijo:

---

19/19 estables. Pruebo el servidor real con curl:

---

Funciona (el código de salida viene de `pkill`, no del servidor). Escribo el README:

---

He implementado el carrito como un servicio REST en Node.js que no necesita ninguna dependencia. Está todo en la carpeta actual. Los 19 tests pasan y también lo he probado arrancando el servidor y llamándolo con `curl`.

**Cómo usarlo**
```bash
npm start   # http://localhost:3000, guarda los carritos en memoria
npm test
REDIS_URL=redis://... CLUSTER=1 npm start   # varias réplicas compartiendo Redis (requiere npm i ioredis)
```

**Qué lo hace escalable**
- **Los procesos no guardan estado.** Los carritos viven en un almacén compartido (Redis), así que se pueden añadir réplicas detrás de un balanceador. Con Redis Cluster, los carritos se reparten entre los nodos.
- **Escrituras simultáneas.** Cada carrito lleva un número de versión y solo se guarda si nadie lo ha cambiado desde que se leyó; en Redis esa comprobación es atómica. Si hay conflicto, el servicio vuelve a leer y reintenta solo. El cliente también puede enviar `If-Match` y recibir un `409` si su versión está desfasada.
- **Reintentos seguros.** Con la cabecera `Idempotency-Key`, un doble clic o un reintento de red no añade el producto dos veces.
- **Precio, nombre y stock salen siempre del catálogo**, nunca del cliente. Al consultar el carrito se recalculan y se avisa si algo cambió: precio distinto, producto retirado, stock insuficiente o cupón caducado.
- **Promociones como reglas añadibles**: descuento en %, descuento fijo, 3x2 y descuento por producto. Para añadir un tipo nuevo basta con registrar una función en `pricing.js`. Los totales incluyen descuentos, envío gratis a partir de cierto importe e IVA, todo en céntimos enteros para evitar errores de redondeo.
- **Otras funciones:**
  - Fusión del carrito de invitado con el del usuario al iniciar sesión.
  - Caducidad automática de carritos abandonados.
  - Un evento por cada cambio, pensado para analítica o correos de recuperación.
  - Límites contra abusos.
  - Apagado ordenado del servidor.

El reparto del código, la API completa y ejemplos están en `README.md`.

**Limitaciones**
- **El repositorio de Redis no está probado contra un Redis real**, solo contra uno simulado en los tests.
- **Varias piezas solo valen para una instancia.** El almacén de idempotencia, el catálogo, los cupones y el sistema de eventos funcionan en memoria. Para tener varias réplicas en producción hay que sustituirlos por versiones reales.
- **El carrito no reserva stock.** Lo comprueba al añadir y al consultar, pero la reserva definitiva tendría que hacerse en el checkout.

Los tests de concurrencia destaparon un fallo en el almacén en memoria: con 50 añadidos simultáneos se perdían actualizaciones. Ya está corregido.
