# AIF · gpt-6-luna · 6/10

**Se atasca en la segunda mezcla.** La mecánica y la interfaz están bien, pero el árbol de recetas está roto y el contenido no es de Web Reactiva.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| mecánica de Infinite Craft | 2 |
| las combinaciones funcionan | 2 |
| progresión | 0 |
| «infinito» | 0 |
| contenido de Web Reactiva | 0 |
| acabado | 1 |
| **Total** | **6** |

## Validación
- `scripts/validar.mjs`: abre sin errores de consola.
- `juez/jugar.mjs`, con la mesa limpia: Web sobre Código da DOM; DOM sobre Estado da Interfaz; Web sobre Evento, sin receta, avisa «Aún no se mezclan…» y no da nada (`capturas/juez-jugar.png`).
- `juez/alcanzables.py`: 23 elementos y 23 recetas; desde Web, Código, Evento y Estado se alcanzan 6 (los cuatro, DOM e Interfaz). Ninguna receta produce Usuario, y de él cuelgan Clic, Acción, Componente y, detrás, React y todo lo demás: 21 recetas tienen un ingrediente imposible.

## Lo que está bien
- Mecánica de Infinite Craft: fichas libres en una mesa, se arrastra una sobre otra y el resultado aparece donde se juntaron.
- Colección por categorías, buscador, ayuda, reinicio y progreso guardado en el navegador.

## Lo que falta o está mal
- Tras dos combinaciones no queda nada que descubrir: el contador se queda en 6 / 23.
- Las parejas sin receta no dan nada.
- El contenido es un tutorial de React (useState, useEffect, dependencias, limpieza); Web Reactiva solo es el nombre del juego y del último elemento.

## Rarezas de la sesión
- No busca nada de Web Reactiva: ni búsqueda web ni lectura de su web. El contenido sale de la palabra «reactiva»: un tutorial de React (useState, useEffect, limpieza, suscripción).
- En el chat dice que está «afinando las combinaciones para que todas funcionen» y quitando dependencias externas; al terminar, 21 de las 23 recetas usan un ingrediente que no se puede conseguir.
- No prueba el juego: 7 peticiones y 141 000 tokens, sin abrirlo en un navegador ni recorrer las recetas.
