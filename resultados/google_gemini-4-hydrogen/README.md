# google/gemini-4-hydrogen

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-20.

**Nota media: 8,8 / 10** (4 de 4 prompts juzgados). Total: 41 peticiones y 1335,9 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio |
|---|---|---:|---:|---:|---|---|
| [A3D](A3D/juicio.md) | visual | 7 | 220,3 k | 9 | a pie de calle, tapado | Ruta guiada a pie de calle por ocho paradas con three.js, que arranca sola y además se puede explorar en órbita o a pie con WASD; se reconocen la fuente de los Leones, la alberca de Arrayanes, el patio circular de Carlos V y la acequia del Generalife. Pero unos marcadores numerados enormes tapan media pantalla en cada parada y en el Salón de Embajadores la cámara queda contra un muro. |
| [AIF](AIF/juicio.md) | visual | 8 | 405,4 k | 9 | de la casa, sin infinito | Mesa libre donde se suelta una ficha sobre otra, 109 elementos y 255 recetas todos alcanzables desde Código, Web, IA y Podcast, con pista de Robotito, buscador, Atlas Malandriner con rangos y guardado. El contenido sale de webreactiva.com (Robotito, Zona Premium, En Pantuflas, Atlas Malandriner, Programa con IA), pero las mezclas sin receta no dan nada. |
| [CCA](CCA/juicio.md) | código | 22 | 678,4 k | 8 | bien hecho, poca concurrencia | Librería TypeScript sin dependencias, hexagonal, con dinero en céntimos, precio del catálogo, promociones (porcentaje, fijo, 3x2, volumen), IVA por categoría, envío, idempotencia, fusión de carritos y checkout con compensación de stock; 14 tests y una demo que funcionan. La versión optimista no pierde datos, pero con 50 altas a la vez rechaza 45 porque reintenta cinco veces sin esperar, y solo hay adaptadores en memoria. |
| [PTS](PTS/juicio.md) | texto | 4 | 31,8 k | 9 | claro y útil, algo de slop | Defiende la tesis con su mecanismo: sin tests el equipo sabe que va a ciegas y actúa con cautela, mientras que un test intermitente le enseña a pulsar re-run hasta que el fallo real pasa con el sello de «todos los checks en verde». Trae código (el sleep de 100 ms que en CI tarda 120), causas típicas y qué hacer, pero con el formato de blog generado: 19 negritas, listas con etiqueta y «En resumen». |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché).

## Rarezas

**A3D**

- Lo probó en Chrome con Playwright: arrancó la página, saltó a las paradas 4 y 6 y comprobó los títulos antes de dar por terminado.
- Comprobó con curl que el CDN de three.js respondía antes de usarlo.
- 7 peticiones, 220 000 tokens, 0,43 $.

**AIF**

- La primera búsqueda web quedó cancelada por el permiso de OpenCode (el lanzador contestó «Decide tú.»); volvió a buscar, esta vez pasó, y leyó la portada de webreactiva.com con webfetch.
- Se comprobó con node: recetas duplicadas (8), las quitó y verificó 109/109 alcanzables.
- 8 peticiones, 405 000 tokens, 0,47 $: la mitad de peticiones y de coste que Carbon en el mismo prompt.

**CCA**

- Un test de concurrencia falló (13/14) y lo arregló subiendo los reintentos por defecto de 3 a 5: ajustó un parámetro hasta que el test pasó.
- Entrega la carpeta dist/ compilada junto al código.
- 22 peticiones, 678 000 tokens, 0,43 $.

**PTS**

- 4 peticiones, 32 000 tokens, 0,05 $: leyó la carpeta, escribió el post y terminó.
