# nido — carrito de compra

Tienda de demostración responsive, sin dependencias ni proceso de compilación. Abre `index.html` en un servidor estático local (por ejemplo, `python3 -m http.server`) para usar los módulos JavaScript.

## Funcionalidad

- Catálogo con búsqueda, filtros por categoría y orden por precio.
- Carrito lateral con cantidades, eliminación, subtotal y umbral de envío gratis.
- Persistencia local entre visitas mediante `localStorage`.
- Separación entre catálogo (`src/products.js`), reglas y estado (`src/cart-store.js`) y presentación/interacciones (`src/main.js`). El store puede conectarse a una API o sustituirse por otro adaptador sin cambiar el catálogo visual.

El botón de pago es una acción de demostración: conectar una pasarela requiere un backend de pedidos y pagos.
