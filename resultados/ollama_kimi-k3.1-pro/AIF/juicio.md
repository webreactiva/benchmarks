# AIF · ollama/kimi-k3.1-pro · 9/10

**Pulido y de Web Reactiva de verdad.** Contenido sacado de cuatro páginas de webreactiva.com (Malandriner, En pantuflas, Claude Code, Skills, MCP, SDD, «Deploy en viernes»), 98 elementos todos alcanzables, rangos («Aprendiz en pantuflas»), hitos, pistas, bitácora y una interfaz de producto. Mesa libre donde se combina soltando una ficha sobre otra. No es infinito: las mezclas sin receta dan un mensaje.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| mecánica de Infinite Craft | 2 |
| las combinaciones funcionan | 2 |
| progresión | 1 |
| «infinito» | 0 |
| contenido de Web Reactiva | 2 |
| acabado | 1 |
| **Total** | **9** |

## Validación
- Carga sin errores; un HTML de 90 KB sin dependencias.
- Clic en la colección suelta el elemento en la mesa; mover IA sobre Personas da **Prompt** («La instrucción inicial. Mejor con intención que con hechizos.») (`capturas/tras-mezclas.png`).
- `juez/alcanzables.js` (mío, con las recetas del juego): 98 de 98 elementos alcanzables, ninguna referencia rota.

## Lo que está bien
- Leyó la portada, /podcast, /en-pantuflas y /cursos: los cuatro elementos iniciales (Código, IA, Personas, Pantuflas) ya son de la casa.
- Descripciones con la voz de Web Reactiva y un objetivo: crear «Web Reactiva».
- Buscador, orden, pista, bitácora de recetas, rangos, sonidos, guardado.

## Lo que falla
- Soltar un elemento de la colección directamente encima de una ficha la sustituye en vez de combinar: en una prueba desaparecieron «Código» e «IA» de la mesa.
- Sin generador: lo que no tiene receta no da nada.

## Rarezas de la sesión
- 5 lecturas web, una de ellas el logo de la web (que luego no usó: dibujó el suyo).
- Recorrió las 94 combinaciones en Chrome para comprobar el juego entero.
- 25 peticiones y 1,7 millones de tokens.
