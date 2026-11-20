El directorio está vacío y no es un repositorio git. Voy a montar una librería en JavaScript (ES modules) sin dependencias externas, con dominio puro, persistencia desacoplada, control de concurrencia optimista y tests.

---

Ahora el servicio de aplicación, que orquesta catálogo, repositorio, precios y eventos con reintentos ante conflictos de concurrencia.

---

Ahora los tests: dominio, precios, servicio y una prueba de concurrencia real.

---

Antes de ejecutar, reviso un detalle: con 20 escrituras simultáneas sobre el mismo carrito, el peor caso son ~19 reintentos, así que el límite por defecto (5) haría fallar ese test. Lo ajusto para que el test refleje el comportamiento real.

---

Node 22 no acepta un directorio como argumento de `--test`; cambio el script a un glob explícito.

---

Los dos fallos son errores en mis expectativas, no en el código: en el primero olvidé el bucket de bread en el subtotal (899 − 60 = 839), y en el segundo, 20 escrituras desde versión 0 dan versión 20, no 21.

---

Los 30 tests pasan. Ahora un ejemplo ejecutable y el README con el diseño y las decisiones de escalado.

---

El ejemplo cuadra con cálculo manual: subtotal 848 ¢, −150 (3×2) −15 (5 % pan) = 683 ¢, IVA 10 % = 68 ¢, total 751 ¢. Por último, el README.

---

He implementado el carrito en JavaScript (ES modules, sin dependencias) dentro de `/tmp/bench-ws/claude-haiku/CCA`. Los 30 tests pasan (`npm test`) y el ejemplo (`npm run example`) da los totales que calculé a mano.

**Estructura**

- **`src/cart.js`**: dominio puro e inmutable (añadir, fijar cantidad, eliminar, vaciar). Cada operación devuelve un carrito nuevo.
- **`src/pricing.js`**: motor de precios con reglas encadenables (descuento por SKU, por umbral, fijo y 3×2) y el IVA en puntos básicos. Ninguna regla puede dejar el total negativo.
- **`src/repository.js`**: contrato de persistencia con control de concurrencia optimista por `version`.
- **`src/cart-service.js`**: orquesta catálogo, dominio, persistencia y eventos, y reintenta ante conflictos de versión.
- **`src/catalog.js`**, **`src/events.js`**, **`src/money.js`**, **`src/errors.js`**: catálogo por lotes, bus de eventos, importes en enteros y códigos de error estables.
- **`test/`**: 30 tests, incluido uno con 20 escrituras simultáneas sobre el mismo carrito sin pérdida de datos.
- **`README.md`**: decisiones de diseño y pasos para llevarlo a producción.

**Por qué escala**

- El servicio no guarda estado en memoria, así que puede correr en varias réplicas detrás de un balanceador.
- No hay locks distribuidos: cada escritura es condicional por versión (`UPDATE … WHERE version = $3` en SQL, equivalente en Redis o DynamoDB).
- Cada carrito es una unidad de consistencia, así que se puede particionar por `cartId`.

**Decisiones que puedes querer revisar**

- Importes en enteros (céntimos) y tasas en puntos básicos, para evitar errores de redondeo con floats.
- Los precios se calculan al leer y no se guardan, así que las promociones cambian sin migrar datos.
- El precio de una línea se refresca al añadir el producto. El checkout debería revalidarlo; lo dejo indicado en el README.
- Solo hay repositorio y catálogo en memoria. Un adaptador real (Redis, PostgreSQL, DynamoDB) queda fuera del alcance y se implementa contra el contrato de `repository.js`.
- Ajusté el límite de reintentos en el test de concurrencia a 30. Con 20 escrituras simultáneas, el peor caso son 19 reintentos y el valor por defecto (5) haría fallar la operación.

No es un repositorio git, así que no he hecho ningún commit.
