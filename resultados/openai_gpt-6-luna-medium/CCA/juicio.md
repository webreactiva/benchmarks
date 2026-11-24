# CCA · gpt-6-luna · 3/10

**Escaparate sin escala.** Una tienda en el navegador cuidada, sin servidor, sin tests y sin tope de cantidad.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| se instala y ejecuta | 1 |
| tests | 0 |
| dominio | 1 |
| dinero exacto | 1 |
| precio del catálogo y validación | 0 |
| concurrencia | 0 |
| escala horizontal | 0 |
| explica el escalado | 0 |
| **Total** | **3** |

## Validación
- `juez/jugar.mjs` sirve una copia con un servidor estático (usa módulos ES): dos jarrones y una taza dan 3 artículos y 100 €; quitar la taza deja 76 €; al recargar se conserva. Sin errores de consola.
- localStorage manipulado (`jarron-arcilla: 1e9`, `taza-origen: -3`, `vela-pausa: 1.5`, `../x: 2`): descarta los tres últimos, pero se queda con mil millones de jarrones y un subtotal de 38.000.000.000 €.
- No hay tests ni nada que ejecutar aparte de la página.

## Lo que está bien
- Dominio completo de carrito: añadir, cambiar cantidad, quitar, vaciar, subtotal y progreso hacia el envío gratis.
- El precio siempre sale del catálogo y el estado guardado solo lleva id y cantidad.
- Código ordenado: catálogo, store observable e interfaz por separado.

## Lo que falta o está mal
- Ningún tope de cantidad: astra y sol limitaban a 99; aquí cabe cualquier entero positivo.
- Precios en euros enteros y el formato sin decimales: no hay céntimos que redondear, pero tampoco un modelo de dinero.
- «Escalable» se queda en la separación de módulos: sin servidor, sin almacenamiento compartido, sin concurrencia y sin explicación en el README.

## Rarezas de la sesión
- Lo primero que busca son las instrucciones locales del proyecto (AGENTS.md) y, al ver la carpeta vacía, decide hacer una tienda en el navegador.
- Entiende «escalable» como separar catálogo, estado e interfaz: no hay servidor, ni almacenamiento compartido, ni concurrencia.
- No prueba nada: 3 órdenes de shell, 4 peticiones y 75 000 tokens, sin abrir la página.
- Las fotos de producto son enlaces a Unsplash: sin conexión, la tienda sale sin imágenes.
