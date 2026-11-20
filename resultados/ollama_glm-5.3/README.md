# ollama/glm-5.3

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-20.

**Nota media: 8,5 / 10** (4 de 4 prompts juzgados). Total: 83 peticiones y 7810,4 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 21 | 3065,1 k | 8 | bonita, con tropiezos | Maqueta con three.js y nueve paradas, de la Puerta de la Justicia al Generalife, con ruta guiada que vuela de una a otra, itinerario clicable y vista aérea en la que se reconoce el recinto: Carlos V circular, la fuente de los Leones, el Patio de la Acequia. Pero en Arrayanes la cámara queda contra un muro, en Leones un marcador tapa media vista y sitúa a Washington Irving hospedado en la Plaza de los Aljibes. | [▶ alhambra-ruta-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_glm-5.3/A3D/salida/alhambra-ruta-3d.html) |
| [AIF](AIF/juicio.md) | visual | 29 | 2753,7 k | 10 | infinito y de la casa | Tablero libre donde se suelta una ficha sobre otra, 187 elementos y 192 recetas todos alcanzables desde Humano, Café, Prompt y Terminal, y un generador para las mezclas sin receta que cuenta los inventos aparte. El contenido sale de la portada de webreactiva.com (Programa con IA, Fichómetro, Atlas Malandriner, En Pantuflas, «sin alucinar»), con pistas, retos, buscador y guardado. | [▶ alquimia-reactiva.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_glm-5.3/AIF/salida/alquimia-reactiva.html) |
| [CCA](CCA/juicio.md) | código | 31 | 1975,7 k | 8 | limpio, una sola instancia | API Express en TypeScript con capas y puertos, SQLite nativo de Node, dinero en céntimos, precio siempre del catálogo, descuentos, envío, IVA, checkout con stock, validación estricta y una interfaz web; compila, pasa 19 tests y 50 altas a la vez en una instancia no pierden nada. Pero no tiene control de versión: con dos instancias sobre el mismo SQLite seis de cincuenta altas acaban en error 500. | – |
| [PTS](PTS/juicio.md) | texto | 2 | 16,0 k | 8 | buen argumento, descuidado | Defiende bien la tesis: sin tests el equipo sabe que no tiene red y va con cuidado; con tests intermitentes aprende a pulsar retry y el fallo real se cuela, además de inflar la cobertura. Trae código del sleep frente a esperar la condición, causas y qué hacer, pero con erratas («cuarenta» por «cuarentena», «Pensa»), un pastor convertido en guardia y un flake8-ignore-comments que no sirve para silenciar tests. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Lo reescribió entero tras revisar la geometría y lo probó en Chrome con Playwright: capturas del tour y análisis de los píxeles para comprobar que el cielo y la piedra se veían.
- Buscó navegadores también en /root/.cache/ms-playwright (vacío dentro del encierro).
- 21 peticiones y 3,1 millones de tokens (2,9 de caché).

**AIF**

- Las dos búsquedas web fallaron (una cancelada por el permiso y otra sin resultado); leyó la portada de webreactiva.com con webfetch.
- Lo probó a fondo en Chrome con Playwright: arrastrar, combinar, borrar, duplicar, y validó con un BFS que todo era alcanzable.
- 29 peticiones y 2,8 millones de tokens (2,5 de caché).

**CCA**

- Preguntó con la herramienta de preguntas qué stack usar; el lanzador la cerró y siguió con su opción recomendada (Node/Express + TypeScript).
- Lo probó de punta a punta con curl contra el servidor, incluido que el stock persiste entre reinicios.
- Entrega dist/ y data/cart.db junto al código.
- 31 peticiones y 2 millones de tokens (1,8 de caché).

**PTS**

- 2 peticiones y 15.998 tokens: escribió el post de una vez y terminó.
