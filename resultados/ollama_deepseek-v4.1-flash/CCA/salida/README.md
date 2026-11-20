# Nébula Store · Carrito de la compra escalable

Demo funcional de una tienda con carrito de la compra construida en JavaScript puro
(ES Modules), sin dependencias externas. Está organizada por capas para que el dominio
del carrito pueda crecer sin acoplarse a la interfaz ni al almacenamiento.

## Puesta en marcha

```bash
npm start        # servidor estático en http://localhost:4173
npm test         # 23 tests con node:test
```

También puedes servir la carpeta con cualquier servidor estático. Los módulos ES no
funcionan abriendo `index.html` con `file://`.

## Funcionalidades

- Catálogo con búsqueda, filtro por categoría y ordenación.
- Añadir, incrementar, decrementar y eliminar productos.
- Persistencia automática del carrito en `localStorage`.
- Descuento por volumen (10 % a partir de 3 unidades de una misma línea).
- Cupones porcentuales y de importe fijo con mínimo de compra.
- Envío gratis a partir de 50 € y barra de progreso.
- IVA calculado sobre el subtotal con descuento y el envío.
- Resumen de totales desglosado y confirmación de pedido.
- Interfaz responsive con panel lateral accesible (foco, Escape, `aria-*`).
- Totales siempre en céntimos enteros para evitar errores de coma flotante.

## Arquitectura

```
CCA/
├── index.html
├── styles.css
├── server.js                     Servidor estático sin dependencias
├── src/
│   ├── core/
│   │   ├── Cart.js               Dominio del carrito (estado + eventos)
│   │   ├── CheckoutService.js    Creación del pedido
│   │   ├── EventEmitter.js       Pub/sub reutilizable
│   │   ├── money.js              Utilidades de dinero en céntimos
│   │   └── pricing/
│   │       ├── PricingEngine.js  Pipeline de reglas ordenadas por prioridad
│   │       └── rules.js          Volumen, cupón, envío e IVA
│   ├── storage/
│   │   ├── LocalStorageAdapter.js
│   │   └── MemoryStorageAdapter.js
│   ├── data/
│   │   ├── catalog.js
│   │   └── coupons.js
│   ├── config/pricing.js         Composición de las reglas por defecto
│   └── ui/app.js                 Render y eventos de la interfaz
└── tests/
    ├── cart.test.js
    ├── pricing.test.js
    └── checkout.test.js
```

### Dominio desacoplado

`Cart` no conoce el DOM ni `localStorage`. Recibe un adaptador de almacenamiento y un
motor de precios por inyección de dependencias:

```js
const cart = new Cart({
  storage: new LocalStorageAdapter(),
  pricing: createDefaultPricing(),
});

cart.add(product, 2);
console.log(cart.totals().totalCents);
```

Expone eventos (`cart:item-added`, `cart:item-updated`, `cart:item-removed`,
`cart:coupon-applied`, `change`…), por lo que cualquier interfaz puede suscribirse sin
modificar el núcleo.

### Precios extensibles

Cada regla implementa `apply(context)` y declara una prioridad. El motor ejecuta el
pipeline en orden y permite añadir lógica nueva sin tocar las reglas existentes:

```js
const pricing = createDefaultPricing();

pricing.register({
  name: 'black-friday',
  priority: 5,
  apply(context) {
    context.addDiscount({
      label: 'Black Friday · 20 %',
      amountCents: Math.round(context.subtotalCents * 0.2),
    });
  },
});
```

Reglas incluidas: descuento por volumen, cupones, envío gratis y IVA. El resultado
incluye el desglose (`discounts`) y metadatos para la UI (por ejemplo, cuánto falta
para el envío gratis).

### Almacenamiento intercambiable

Cualquier adaptador que implemente `load()`, `save(state)` y `clear()` puede sustituir
a `localStorage`. Para pasar a un backend bastaría con crear un `ApiCartAdapter`
(asíncrono) y adaptar la carga inicial, manteniendo intacto el dominio.

### Checkout

`CheckoutService` valida que el carrito no esté vacío, calcula el pedido con el mismo
motor de precios, lo devuelve con identificador y fecha, y vacía el carrito. En esta
demo el pago es simulado; la frontera está aislada para conectar una pasarela real.

## Cupones de prueba

| Código         | Efecto                                   | Mínimo |
| -------------- | ---------------------------------------- | ------ |
| `BIENVENIDO10` | 10 % de descuento                        | 0 €    |
| `AHORRA15`     | 15 % de descuento                        | 80 €   |
| `CINCO`        | 5 € de descuento directo                 | 30 €   |

## Tests

La suite cubre el ciclo del carrito, la persistencia, los eventos, el pipeline de
precios (volumen, cupones, envío, IVA, límites) y el checkout. Se ejecuta con el
runner nativo de Node 22:

```bash
npm test
```

## Decisiones de diseño

- **Dinero en céntimos enteros:** evita redondeos inconsistentes en subtotales e IVA.
- **Sin dependencias:** arranque inmediato y superficie mínima que mantener.
- **Inyección de dependencias:** dominio, precios y almacenamiento se pueden probar y
  reemplazar por separado.
- **Reglas ordenadas:** los descuentos se aplican antes del envío y del IVA, y el envío
  gratis se evalúa sobre el subtotal ya descontado.
- **UI por delegación de eventos:** menos listeners y renderizados más predecibles.
- **Accesibilidad:** panel modal con foco gestionado, cierre con Escape y etiquetas ARIA.

## Siguientes pasos razonables

- Sustituir el catálogo local por una API y añadir caché.
- Adaptador de carrito remoto con sincronización y resolución de conflictos.
- Control de stock y reservas por producto.
- Cupones de un solo uso validados en servidor.
- Internacionalización de moneda y textos.
- Tests end-to-end con Playwright y despliegue estático.
