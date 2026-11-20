# AIF · claude-opus-5-5 (medium, Claude Code) · 8/10

**Gran juego, Web Reactiva a medias.** Mesa libre con 178 elementos, todos alcanzables, y muy pulida, pero lo de Web Reactiva es la capa de marca recordada, sin sus temas.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| mecánica de Infinite Craft | 2 |
| las combinaciones funcionan | 2 |
| progresión | 1 |
| «infinito» | 0 |
| contenido de Web Reactiva | 1 |
| acabado | 1 |
| **Total** | **8** |

## Validación
- `validar.mjs`: carga sin errores de consola; 26 KB sin dependencias. Arranca con los cuatro básicos ya colocados en el tablero (`capturas/inicio.png`).
- Jugando con el ratón (`juez/jugar.cjs`, en una copia en `/tmp`, tras limpiar el tablero): Código + Café → **Programador**, Idea + Bug → **Feature**, Código + Código → **Programa** (`capturas/codigo-cafe.png`). En la primera pasada, sin limpiar, la ficha soltada cayó sobre el Bug del tablero y dio Error: también combina al soltar sobre lo que ya hay.
- Mezcla sin receta (Feature sobre Programador): tiemblan y sale un chiste al azar, «Funciona en mi máquina… pero aquí no» (`capturas/sin-receta.png`).
- Pista: resalta en la lista un elemento que tiene una receta pendiente (`capturas/pista.png`). Buscador («pro» → Programador, Programa), tres órdenes y el progreso se conserva al recargar (el tablero no).
- `juez/alcanzables.js`, con el parser y la `key()` del propio juego: **178 de 178 elementos alcanzables** con 181 recetas; 7 resultados tienen más de una receta.

## Lo que está bien
- Mecánica fiel: lista lateral, tablero libre, soltar encima para combinar, doble clic duplica, clic derecho o volver a la lista borra, toque en móvil.
- Recetas con gracia y bien encadenadas: Vim + Error → Salir de Vim, Reunión + Reunión → Esto pudo ser un email, CSS + Error → Centrar un div, Deploy + Error → Deploy en viernes, Junior + Bug → Síndrome del impostor.
- Cinco objetivos con candado (Web Reactiva, Dani Primo, Malandriner, Comunidad Malandriner, Web Reactiva Premium) que dan rumbo a la partida.

## Lo que falta o está mal
- **Web Reactiva a medias**: unos 20 de 178 elementos (Podcast, Newsletter, Episodio, Oyente, Dani Primo, Malandriner, Comunidad Malandriner, Premium, Retos de programación). Nada de lo que trata ahora la web (agentes, skills, MCP, SDD, En pantuflas). Es la misma vara que GPT-6.2-Astra (medium) o Inkling: marca y comunidad sí, temas no.
- **No es infinito**: fuera de las 181 recetas, un mensaje de broma y nada más. Lo explica en la respuesta.

## Rarezas de la sesión
- Tenía WebSearch y WebFetch y no los usó: Dani Primo, Malandriner y la comunidad salen de memoria.
- Mete a Dani Primo como elemento y avisa al final de que, si se comparte, quizá convenga «confirmar que le parece bien».
- Comprobó con node que no hay recetas duplicadas, que se llega a los 178 elementos y que el JavaScript compila; dice que no lo probó en un navegador. Lo que cuenta en el chat coincide con el disco.
- 4 peticiones, 245 k tokens, 0,99 $ y 4 min 36 s: el triple de gasto que Sonnet en la misma prueba. No leyó nada fuera de su carpeta (`fugas.py` limpio).
