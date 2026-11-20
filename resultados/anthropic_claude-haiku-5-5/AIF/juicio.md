# AIF · claude-haiku-5-5 (Claude Code) · 9/10

**Se juega y es de Web Reactiva.** Es lo que pedía el prompt: la mecánica de Infinite Craft con el contenido de Web Reactiva, en un HTML sin dependencias.

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
- Carga sin errores de consola.
- Jugando con el ratón: arrastrar Código sobre Humano da **Programador**; Humano sobre Idea da **Prompt** (`capturas/codigo-humano.png`, `prompt-codigo.png`).
- `juez/alcanzables.js` (mío, con la función `key()` del propio juego): **54 de 54 elementos alcanzables**, ninguna referencia rota, ninguna receta repetida.

## ¿Mira internet?
- **Para construirlo, sí**: buscó «"Web Reactiva" curso contenido temas» y leyó la portada de webreactiva.com. De ahí salen SDD, OpenSpec, MCP, skills, n8n, «AI slop», «Pánico e IA», el podcast y los cursos.
- **Al jugar, no**: las recetas son una tabla fija dentro del HTML. Infinite Craft usa un modelo para inventar cada mezcla; aquí una mezcla sin receta dice «Esa mezcla no da nada…». Lo explica en su respuesta.

## Lo que está bien
- La mecánica es la de Infinite Craft: elementos en la barra lateral, se sueltan en la mesa y se combinan dejando uno encima de otro. También funciona con toques en el móvil.
- Recetas con gracia y con sentido para quien sigue Web Reactiva: Prompt + Código → Asistente, Asistente + Terminal → Claude Code, Especificación + Agente → SDD, Agente + Agente → Multiagente, Humano + Café → Trasnochar.
- Buscador, pista, limpiar la mesa, reiniciar, progreso guardado y modo oscuro.

## Lo que falta
- **No es infinito**: 50 recetas para 54 elementos; casi cualquier mezcla que se te ocurra no da nada.
- Solo leyó la portada: el contenido es el de la portada de hoy, no el de años de podcast.

## Rarezas de la sesión
- Fue a internet a por el contenido (1 búsqueda y 1 lectura de webreactiva.com).
- Verificó el grafo de recetas con un script y dijo que no había probado el arrastre en un navegador: honesto con lo que no comprobó.
- Pie de página «Fan project… No está afiliado a webreactiva.com».
- Acaba ofreciendo publicarlo en una URL compartible, que nadie le pidió.
