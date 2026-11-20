# AIF · claude-sonnet-5-5 (medium, Claude Code) · 7/10

**Buen juego, otra Web Reactiva.** La mecánica es la de Infinite Craft y todo se alcanza, pero el contenido es «web reactiva» en minúsculas: programación reactiva y diseño responsive, no Web Reactiva.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| mecánica de Infinite Craft | 2 |
| las combinaciones funcionan | 2 |
| progresión | 1 |
| «infinito» | 0 |
| contenido de Web Reactiva | 0 |
| acabado | 1 |
| **Total** | **7** |

## Validación
- `validar.mjs`: carga sin errores de consola; 22 KB sin dependencias.
- Jugando con el ratón (`juez/jugar.cjs`, en una copia en `/tmp`): de la lista a la mesa y una ficha encima de otra. Estado + Evento → **Reactividad**, Píxel + Pantalla → **Resolución**, Estado + Estado → **Store** (`capturas/estado-evento.png`).
- Mezcla sin receta (Resolución sobre Reactividad): las fichas tiemblan y sale «no pasa nada…» (`capturas/sin-receta.png`).
- Al recargar conserva los 7 descubrimientos y las fichas de la mesa (`capturas/tras-recargar.png`). El buscador filtra («reac» → Reactividad). No hay botón de pista.
- `juez/alcanzables.js`, con los datos y la `key()` del propio juego: **63 de 63 elementos alcanzables** con 59 recetas, sin ingredientes inexistentes ni recetas repetidas.

## Lo que está bien
- Mesa libre, arrastre con pointer events (ratón y táctil), resaltado de la ficha de destino, doble clic para duplicar y soltar en la lista para borrar.
- Árbol de recetas coherente y con sentido didáctico: Señal + Evento → Efecto, Efecto + Efecto → Bucle Infinito, Framework + Señal → Solid, Grid + Media Query → Layout Adaptable. Cada elemento trae una explicación de una línea.
- Meta final (Programación Reactiva + Responsive Design → Web Reactiva) con aviso de victoria, marca «NUEVO», modo oscuro y guarda también la mesa.

## Lo que falta o está mal
- **No es contenido de Web Reactiva**: ni podcast, ni newsletter, ni comunidad, ni Dani Primo, ni los temas de la web. Toma el nombre como «web que reacciona» y lo rellena con conceptos de frontend. En la vara de AIF eso es «solo el nombre», como nemotron o beam.
- **No es infinito**: fuera de las 59 recetas, nada.
- Sin pistas: con 63 elementos y recetas como Píxel + Estado → Porcentaje, se atasca uno pronto.

## Rarezas de la sesión
- Tenía WebSearch y WebFetch y no los usó. Decidió qué era Web Reactiva por el nombre y lo cuenta: «puede significar programación reactiva o diseño responsive, así que usé los dos».
- Cierra con «Si te referías a una web o curso concreto, dime qué temas incluye y adapto los elementos»: la duda que debió resolver buscando.
- Comprobó la alcanzabilidad con un script de Python y avisa de que no lo abrió en un navegador. En el chat habla de «63 recetas»: son 59 (63 son los elementos).
- 4 peticiones, 187 k tokens, 0,30 $ y menos de dos minutos. No leyó nada fuera de su carpeta (`fugas.py` limpio).
