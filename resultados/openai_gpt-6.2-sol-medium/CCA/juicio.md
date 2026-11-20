# CCA · gpt-6.2-sol (medium) · 5/10

**Bonita tienda, no escala**

## Validación

- En una copia: `npm test` pasa 4 de 4; `npm start` sirve la app (sin dependencias). El servidor responde 404 a `/../server.js` y `/%2e%2e/package.json`.
- `juez/juez.mjs` sobre las funciones de `cart.js` (no hay API): 0,10 × 3 = 30 céntimos; id `../etc` ignorado; cantidades -5 y 1,5 a 0 y 1e9 al tope de existencias; un localStorage manipulado solo conserva id y cantidad válidos.
- El objeto que devuelve `quoteCart` contiene el producto del catálogo: cambiar su precio cambia el catálogo.
- Las 50 altas a la vez no se pueden probar: el carrito vive en el navegador.

## Lo que está bien

- El carrito es un conjunto de funciones puras e inmutables, en céntimos, con existencias, cupón, envío gratuito desde 75 € y persistencia versionada.
- Valida bien lo que lee: el precio siempre sale del catálogo y del localStorage solo se aceptan id y cantidad.
- La tienda está muy cuidada: fotos de producto propias, deshacer al quitar, sincronización entre pestañas, pedido simulado.

## Lo que falta o está mal

- «Escalable» lo entiende como catálogo ampliable y diseño adaptable. No hay servicio de carrito, ni almacenamiento compartido, ni nada que aguante varias instancias o altas concurrentes.
- El catálogo y los precios están en el cliente.
- El README no explica decisiones de escalado: solo avisa de que para producción haría falta un servicio con almacenamiento compartido.
- No hay botón para vaciar: el carrito se vacía al confirmar el pedido.

## Rarezas de la sesión

- Lee la skill de serie `imagegen` y genera una hoja de contacto con seis fotos de producto que recorta en WebP.
- Descarga las fuentes DM Sans y DM Serif Display con sus licencias.
- Instala navegadores en `/tmp` para probar y no consigue abrir ninguno; comprueba el flujo en un DOM simulado.
