# Carrito de la compra escalable

Librería de carrito en JavaScript (ES modules) sin dependencias externas. Separa
el dominio, los precios, la persistencia y el catálogo para que cada pieza pueda
crecer o cambiar por separado.

Requisitos: Node.js 20+.

```bash
npm test          # 30 tests (node:test)
npm run example   # demo de uso
```

## Uso rápido

```js
import {
  CartService, InMemoryCartRepository, InMemoryCatalog,
  percentOffSku, buyXPayY, formatMoney,
} from './src/index.js';

const catalog = new InMemoryCatalog([
  { sku: 'APPLE', name: 'Manzana', unitPriceCents: 150, currency: 'EUR' },
]);

const carts = new CartService({
  repository: new InMemoryCartRepository(), // sustituir por un adaptador real
  catalog,
  pricing: {
    taxRateBps: 1000,                        // 10 %
    rules: [buyXPayY({ sku: 'APPLE', buy: 3, pay: 2 })],
  },
});

await carts.createCart({ currency: 'EUR', id: 'cart-42' });
await carts.addItem('cart-42', 'APPLE', 3);
const totals = await carts.getTotals('cart-42');
console.log(formatMoney(totals.totalCents, totals.currency)); // 3,00 € → 3,30 € con IVA
```

## Arquitectura

```
src/
  errors.js       CartError + códigos estables (para mapear a HTTP)
  money.js        Importes en enteros (unidad menor), formato, basis points
  cart.js         Dominio PURO e inmutable: addItem, setQuantity, removeItem, clear
  pricing.js      Motor de precios: reglas encadenables + impuestos
  repository.js   Contrato de persistencia + implementación en memoria (versionada)
  catalog.js      Contrato de catálogo (consulta por lotes) + implementación en memoria
  events.js       Bus de eventos para efectos secundarios
  cart-service.js Orquestación: catálogo → dominio → persistencia → eventos
  index.js        API pública
```

Capas y dependencias: `cart.js` y `pricing.js` no conocen I/O. `cart-service.js`
recibe repositorio, catálogo y bus de eventos por inyección.

### Decisiones clave

| Tema | Decisión | Motivo |
|---|---|---|
| Dinero | Enteros en unidad menor, nunca floats | Evita errores de redondeo acumulados |
| Tasas | Basis points (`1000` = 10 %) | Aritmética entera también para impuestos y descuentos |
| Estado | Inmutable; cada operación devuelve un carrito nuevo | Fácil de testear, razonar y serializar |
| Concurrencia | Control optimista por `version` + reintentos | Sin locks distribuidos; varias instancias pueden atender el mismo carrito |
| Precios | Se calculan al leer (`getTotals`), no se guardan | Promociones y tasas cambian sin migrar datos |
| Precio en línea | Se refresca al añadir/sumar el producto | Simple; el checkout debería revalidar precios (ver abajo) |
| Límites | `maxLines` y `maxQuantityPerLine` configurables | Acotan el tamaño del documento y el coste por petición |
| Descuentos | Lista de reglas aplicadas en cadena, sin total negativo | Añadir promociones sin tocar el motor |

### Concurrencia optimista

Cada mutación sigue el ciclo *leer → transformar → guardar si la versión no cambió*:

```sql
UPDATE carts SET lines = $1, version = version + 1
 WHERE id = $2 AND version = $3;   -- 0 filas => CONCURRENCY_CONFLICT => reintento
```

El servicio reintenta hasta `maxRetries` veces (por defecto 5) con el estado
más reciente. Un carrito lo modifica normalmente una sola persona, así que los
conflictos son raros; con muchas escrituras simultáneas sobre el mismo carrito,
sube `maxRetries` o añade *backoff* con jitter en el adaptador.

## Escalar a producción

La librería ya está preparada para escalar horizontalmente; estos son los pasos
para desplegarla:

1. **Persistencia**: implementar el contrato de `repository.js` con un almacén
   que soporte escritura condicional por versión:
   - **Redis**: `WATCH` + `MULTI/EXEC` o un script Lua que compare `version`.
   - **PostgreSQL / MySQL**: la sentencia `UPDATE ... WHERE version = $3` de arriba.
   - **DynamoDB**: `ConditionExpression: "version = :v"`.
   Clave de partición: `cart.id`. Un carrito es una unidad de consistencia, así que
   el sharding por `cartId` escala sin coordinación entre nodos.
2. **Stateless**: el `CartService` no guarda nada en memoria de proceso; se
   despliega como N réplicas detrás de un balanceador.
3. **Catálogo**: implementar `getProducts(skus)` por lotes contra el servicio de
   catálogo, con caché (p. ej. Redis, TTL de 1–5 min). `#resolveProduct` ya
   consulta una sola vez por operación.
4. **Caducidad**: TTL en el almacén para carritos abandonados (p. ej. 30 días).
5. **Eventos**: `EventBus` es en memoria; en producción conviene reenviar
   `cart.created`, `item.added`, etc. a una cola (Kafka, SQS, Redis Streams) para
   analítica, invalidación de caché o recordatorios de carrito abandonado.
6. **Checkout**: antes de cobrar, revalidar precios y disponibilidad contra el
   catálogo. El precio guardado en la línea es una foto del momento en que se añadió.
7. **Observabilidad**: los códigos de `CartError` son estables; úsalos como
   etiquetas de métricas (`CONCURRENCY_CONFLICT` indica contención en un carrito).

### Qué no incluye (a propósito)

- Adaptadores reales de base de datos o cola: solo existen las implementaciones
  en memoria, que sirven para tests y desarrollo.
- Autenticación, autorización y propiedad del carrito (eso va en la capa HTTP).
- Stock/inventario y reserva de unidades.
- Multimoneda dentro de un mismo carrito (cada carrito tiene una sola moneda).

## Estructura de tests

- `test/cart.test.js`: dominio puro, inmutabilidad, límites y validaciones.
- `test/pricing.test.js`: reglas de descuento, impuestos, redondeo, formato.
- `test/service.test.js`: flujo completo, eventos, reintentos y concurrencia real
  (20 escrituras simultáneas sobre el mismo carrito sin pérdida de datos).
