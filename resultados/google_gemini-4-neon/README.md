# google/gemini-4-neon

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-20.

**Nota media: 9,3 / 10** (3 de 4 prompts juzgados). Total: 45 peticiones y 2143,3 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio |
|---|---|---:|---:|---:|---|---|
| [A3D](A3D/juicio.md) | visual | 19 | 1011,5 k | 9 | se recorre y se reconoce | Ruta guiada a pie de calle por siete paradas con three.js, que arranca sola, con modos de órbita, paseo libre y panorámica, minimapa y tres luces; se reconocen el patio circular de Carlos V, el pórtico de Arrayanes con Comares, el templete de los Leones y la acequia del Generalife, y las fichas son correctas. Pero en el Generalife los chorros de agua se ven como cuadrados blancos que tapan media pantalla. |
| [AIF](AIF/juicio.md) | visual | 11 | 894,7 k | 10 | el AIF más documentado | Tablero libre donde se suelta una ficha sobre otra, 144 elementos y 360 recetas todos alcanzables desde Pantuflas, Código, IA y Podcast, con Atlas Malandriner, pistas en dos niveles, buscador y guardado; las mezclas sin receta dan fusiones con el Modo Libre encendido. El contenido sale de ocho páginas de webreactiva.com: Selector de Modelos, Bingo de Mentiras, Chuleta OpenCode, Robotito, LinkedIn-5-5, Fichómetro, skills y SDD. |
| [CCA](CCA/juicio.md) | código | 12 | 213,4 k | – | sin juzgar |  |
| [PTS](PTS/juicio.md) | texto | 3 | 23,7 k | 9 | completo, con tics de formato | Defiende la tesis con su mecanismo: sin tests el equipo sabe que no tiene red; con tests intermitentes aprende a pulsar Re-run y la alarma real se ignora, además de esconder condiciones de carrera reales. Trae una escena reconocible, la cifra correcta (20 tests al 5 % → 36 % de pasar a la primera), código antes y después y qué hacer con los reintentos, pero con el formato de blog generado: 19 negritas, listas con etiqueta y «En resumen». |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché).

## Rarezas

**A3D**

- Tercera tirada: las dos primeras se cortaron con «Network connection lost» porque Neon piensa más de 6 min antes de escribir el HTML (en _descartados/). Esta fue por AI Studio estándar con SALIDA_MAX=65536 y también tuvo cortes, pero los reintentos salieron y la sesión terminó; meta.json guarda el último error.
- Escribió los 103 KB de una vez y revisó el JavaScript con node varias veces; no lo abrió en un navegador.
- 19 peticiones, 1 millón de tokens (860 000 de caché), 1,28 $.

**AIF**

- La primera búsqueda web quedó cancelada por el permiso; buscó otra vez y leyó ocho páginas de webreactiva.com con webfetch, el que más del benchmark.
- El Modo Libre (mezclas sin receta) viene apagado: quien no lo encienda juega a un juego con recetas cerradas.
- 11 peticiones, 895 000 tokens, 1,50 $: el AIF más caro de los Gemini.

**PTS**

- Repetido con SALIDA_MAX=32768 porque la primera tirada no pudo empezar: OpenRouter rechazaba el tope de 65 536 tokens por falta de saldo (en _descartados/).
- 3 peticiones, 24 000 tokens, 0,09 $.
