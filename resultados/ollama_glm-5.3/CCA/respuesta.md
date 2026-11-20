Perfecto, decido yo: **API REST en Node.js + TypeScript** con arquitectura hexagonal (puertos y adaptadores), persistencia **SQLite** (con adaptador en memoria incluido), **tests unitarios** y una **interfaz web** para probarlo. Primero reviso el entorno.

---

El entorno es ideal: Node 22.23 (incluye `node:sqlite` nativo, sin dependencias de base de datos) y acceso a npm. Empiezo a construir el proyecto.

**Decisiones de diseño (escalabilidad):**
- **Arquitectura hexagonal** (puertos y adaptadores): el dominio y los servicios no conocen ni Express ni SQL.
- **Dinero en céntimos enteros** (evita errores de coma flotante).
- **El carrito solo guarda `productId` + cantidad**: los precios se resuelven contra el catálogo en cada lectura (nunca se confía en precios del cliente).
- **Adaptadores intercambiables**: SQLite (persistente) y en memoria (tests / `STORAGE=memory`).

## 1. Base del proyecto y dominio

---

## 2. Puertos y servicios de aplicación

---

## 3. Adaptadores de persistencia (memoria y SQLite)

---

## 4. Capa HTTP (rutas, middleware de errores, app)

---

## 5. Tests unitarios (servicio de pricing y casos de uso)

---

Corrijo dos tests que quedaron confusos (el del mínimo de compra y el de productos retirados, que no se puede simular sin mutar el repositorio):

---

## 6. Interfaz web de demostración

---

## 7. Documentación (README)

---

## 8. Instalar dependencias y verificar

---

Express 5 tipa `req.params` como `string | string[]` (por los comodines de path-to-regexp). Añado un pequeño helper para leer parámetros de ruta y actualizo las rutas:

---

Ajuste menor de tipos en los `.all()` de SQLite:

---

Typecheck limpio y **19/19 tests en verde**. Ahora compilo y hago una prueba de humo del servidor real:

---

El catálogo funciona. Pruebo el flujo completo del carrito:

---

Detecté algo importante: la petición salió con **JSON malformado** y el servidor respondió 500 en vez de 400. Mejoro el middleware para que respete el `status` de los errores de la propia pila HTTP (JSON malformado → 400):

---

El log confirma el diagnóstico (`entity.parse.failed` con `status: 400`) y el cierre limpio con SIGTERM. Reinicio el servidor y repito la prueba de humo completa:

---

Todo el flujo funciona con las matemáticas exactas (descuentos, IVA redondeado, stock). Última comprobación: la UI y el estado final del proyecto:

---

Listo ✅ Carrito de la compra implementado y verificado en `/var/tmp/bench/ws-785ka59g`.

## Qué se construyó

**API REST (Node.js + TypeScript, Express 5)** con arquitectura hexagonal, **SQLite nativo de Node** (cero dependencias nativas) y **UI web** de demostración:

```
src/
├── domain/       # entidades y errores de negocio (cero dependencias)
├── ports/        # interfaces CartRepository / ProductRepository
├── services/     # casos de uso (CartService) + reglas de precio (PricingService)
├── adapters/     # sqlite/ y memory/ — intercambiables por configuración
├── http/         # rutas thin, middleware de errores único, fábrica de la app
└── index.ts      # arranque: elige adaptador y enciende el servidor
public/           # tienda de demostración (HTML/CSS/JS sin build)
tests/            # 19 tests unitarios (vitest)
```

## Claves de escalabilidad

- **Puertos y adaptadores**: cambiar SQLite por PostgreSQL es escribir un adaptador en `src/adapters/postgres/` — nada más cambia.
- **Dinero en céntimos enteros** y una sola fuente de precios (`PricingService`): redondeos por concepto, la suma siempre cuadra.
- **El carrito solo guarda `productId` + cantidad**: los precios se resuelven contra el catálogo en cada lectura; imposible manipular precios desde el cliente.
- **API sin estado** (el cliente guarda su `cartId`) → réplica horizontal directa.
- **Errores con `code` estable** y traducción HTTP en un único middleware.

## Verificado en vivo

- `npm run typecheck` limpio · **19/19 tests** · build OK
- Flujo completo con curl: crear carrito, fusionar líneas, `PATCH`/`DELETE`, descuentos (422 si es inválido), stock (409), checkout con descuento de stock atómico y compensación si falla a mitad, 404/400/409 según toca, y **persistencia entre reinicios** (el stock quedó guardado en `data/cart.db`).
- Regla de negocio confirmada con cifras exactas: 179,87 € − 10 % + IVA redondeado = **195,87 €**.

## Para usarlo

```bash
npm run dev     # http://localhost:3000  (UI + API)
npm test        # tests
```

Variables opcionales: `PORT`, `STORAGE=memory`, `DB_FILE`, `TAX_RATE`, `SHIPPING_CENTS`, `FREE_SHIPPING_THRESHOLD_CENTS`, `DISCOUNT_CODES`. Todo documentado en el `README.md`, junto con ejemplos de curl y una guía de extensión (nueva BD, nuevos tipos de descuento, GraphQL, transacción de checkout).

---

El servidor se detuvo limpiamente (SIGTERM con cierre correcto de la base de datos). El proyecto queda completo y listo para arrancar cuando quieras con `npm run dev` en http://localhost:3000.
