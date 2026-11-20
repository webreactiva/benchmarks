# CCA · gpt-6.2-astra (default) · 4/10

**Maqueta de carrito, sin escalar**

## Validación

- Se abre `index.html` sin instalar nada. No hay tests ni README.
- `juez/jugar.cjs` (en una copia): +1 → total de 92 a 124 €; quitar una lámina → 96 €; se mantiene al recargar.
- localStorage manipulado (`alpes: 1e9`, `lago: -3`, `valle: 1.5`, `../x`, `price`): solo queda `alpes`, con 99 unidades. El precio siempre sale del catálogo.
- Sin servidor: las 50 altas a la vez no se pueden probar.

## Lo que está bien

- Suma, resta, quita y recalcula envío (gratis desde 75 €) y total, en céntimos.
- Valida lo que lee de localStorage y limita la cantidad a 99.
- La página está cuidada: fotos, colección, resumen, carrito vacío.

## Lo que falta o está mal

- No hay nada que escale: ni servicio, ni API, ni almacenamiento compartido, ni concurrencia. El catálogo y los precios viven en el cliente.
- Sin tests y sin README que explique ninguna decisión.
- No hay botón para vaciar.

## Rarezas de la sesión

- Descarga cuatro fotos de Unsplash con curl (y una quinta que luego borra).
- Solo comprueba la sintaxis con `node --check`.
- Escribe los ficheros con una función propia que guarda entre llamadas (`store`/`load`).
