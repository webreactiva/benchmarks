# google/gemini-4-neon

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-24.

**Nota media: 7,6 / 10** (5 de 5 prompts juzgados). Total: 121 peticiones y 6132,4 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 19 | 1011,5 k | 9 | se recorre y se reconoce | Ruta guiada a pie de calle por siete paradas con three.js, que arranca sola, con modos de órbita, paseo libre y panorámica, minimapa y tres luces; se reconocen el patio circular de Carlos V, el pórtico de Arrayanes con Comares, el templete de los Leones y la acequia del Generalife, y las fichas son correctas. Pero en el Generalife los chorros de agua se ven como cuadrados blancos que tapan media pantalla. | [▶ alhambra-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/google_gemini-4-neon/A3D/salida/alhambra-3d.html) |
| [AIF](AIF/juicio.md) | visual | 11 | 894,7 k | 10 | el AIF más documentado | Tablero libre donde se suelta una ficha sobre otra, 144 elementos y 360 recetas todos alcanzables desde Pantuflas, Código, IA y Podcast, con Atlas Malandriner, pistas en dos niveles, buscador y guardado; las mezclas sin receta dan fusiones con el Modo Libre encendido. El contenido sale de ocho páginas de webreactiva.com: Selector de Modelos, Bingo de Mentiras, Chuleta OpenCode, Robotito, LinkedIn-5-5, Fichómetro, skills y SDD. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/google_gemini-4-neon/AIF/salida/index.html) |
| [CCA](CCA/juicio.md) | código | 12 | 213,4 k | 6 | sólido pero sin terminar | TypeScript hexagonal sin dependencias, que Node 22 ejecuta tal cual: dinero en céntimos con moneda comprobada, precio del catálogo, promociones, IVA por región, envío, idempotencia, fusión y checkout con reserva de stock, más una API HTTP y una demo que funciona. La sesión se cortó por falta de crédito antes de los tests y el README, y la versión optimista solo aguanta dentro de un proceso: dos instancias sobre el mismo fichero pierden la mitad de las altas sin avisar. | – |
| [SEC](SEC/juicio.md) | seguridad | – | – | 7 | Un punto por debajo de sus hermanos | 7 sobre 10, un punto por debajo de gemini-4-carbon y gemini-4-hydrogen (8). | – |
| [TCI](TCI/juicio.md) | clasificación | 79 | 4012,8 k | 6 | Bien clasificado, carísimo | Tipo 96,7 %, superficie 89,3 % y F1 de áreas 0,698 frente a jev (94 idénticas). Le costó 558 s, 79 peticiones, 4,01 M tokens y 5,13 $ con seis subagentes: la prueba de TCI más cara. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Tercera tirada: las dos primeras se cortaron con «Network connection lost» porque Neon piensa más de 6 min antes de escribir el HTML (en _descartados/). Esta fue por AI Studio estándar con SALIDA_MAX=65536 y también tuvo cortes, pero los reintentos salieron y la sesión terminó; meta.json guarda el último error.
- Escribió los 103 KB de una vez y revisó el JavaScript con node varias veces; no lo abrió en un navegador.
- 19 peticiones, 1 millón de tokens (860 000 de caché), 1,28 $.

**AIF**

- La primera búsqueda web quedó cancelada por el permiso; buscó otra vez y leyó ocho páginas de webreactiva.com con webfetch, el que más del benchmark.
- El Modo Libre (mezclas sin receta) viene apagado: quien no lo encienda juega a un juego con recetas cerradas.
- 11 peticiones, 895 000 tokens, 1,50 $: el AIF más caro de los Gemini.

**CCA**

- Juzgado tal cual quedó: la sesión se cortó a las 12 peticiones porque OpenRouter rechazó la siguiente con un 402 por falta de saldo (límite nuestro). Nota definitiva.
- Escribió 27 ficheros y 3700 líneas sin ejecutar nada: los cuatro comandos de shell fueron para ver versiones de node, tsc y los paquetes globales.
- Para no depender de @types/node escribió sus propias declaraciones de Node (src/types/node.d.ts), pero le faltó structuredClone: tsc --noEmit da 9 errores aunque el código corre.
- package.json apunta a tests/*.test.ts, que no existe: npm test pasa con 0 tests.
- 12 peticiones, 213 000 tokens, 0,75 $.

**TCI**

- Repartió las 300 incidencias en seis subagentes de 50 (57 de sus 79 peticiones y 2,9 M de sus 4,0 M tokens).
- A los ~5 min, con 4,3 $ gastados, el autor le escribió en la sesión «Ve terminando: no lances más subagentes, junta lo que ya tengas clasificado, clasifica tú lo que falte y guarda clasificacion.jsonl cuanto antes». No estaba en el prompt; los subagentes ya lanzados terminaron igual.
- SEC no se lanzó: con lo que gastó en TCI no quedaba saldo en OpenRouter.
- OpenCode apuntaba en meta.json solo el coste de la sesión principal (0,89 $); el real con los subagentes es 5,13 $. Corregido en tokens-subagentes.py.
