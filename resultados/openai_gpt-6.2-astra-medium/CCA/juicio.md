# CCA · gpt-6.2-astra (medium) · 4/10

**Tienda de café, sin escalar**

## Validación

- Se abre `index.html` sin instalar nada. No hay tests ni README.
- `juez/jugar.cjs` (en una copia): +1 → 58,45 € a 69,00 € (deja de cobrar envío al pasar de 60 €); −1 vuelve a 58,45 €; quitar → 43,95 €; se mantiene al recargar.
- localStorage manipulado (`colombia: 1e9`, `v60: -3`, `taza: 1.5`, `../x`, `price`): solo queda `colombia`, con 99 unidades (1435,50 €). El precio siempre sale del catálogo.
- Sin servidor: las 50 altas a la vez no se pueden probar.

## Lo que está bien

- Suma, resta, quita, guarda para después y recalcula en céntimos.
- Valida lo que lee de localStorage y limita la cantidad a 99.
- Página cuidada, con fotos de producto generadas.

## Lo que falta o está mal

- Nada escala: ni servicio, ni API, ni almacenamiento compartido, ni concurrencia. El catálogo y los precios viven en el cliente.
- Sin tests ni README.
- No hay botón para vaciar.

## Rarezas de la sesión

- Lee la skill de serie `imagegen` y genera tres fotos de producto que convierte a WebP con `sips` y `cwebp`.
- Comprueba los cálculos y la persistencia con un script propio, pero no lo deja como test.
