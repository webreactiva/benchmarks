# ollama/minimax-m3.1-flash

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-20.

**Nota media: 8,5 / 10** (4 de 4 prompts juzgados). Total: 314 peticiones y 28354,7 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio |
|---|---|---:|---:|---:|---|---|
| [A3D](A3D/juicio.md) | visual | 90 | 8784,4 k | 8 | mucho detalle, textos inventados | El A3D más grande: 16 paradas, cámara sobre una curva que recorre el recinto, Carlos V con su patio circular, murallas, jardines, Sierra Nevada, minimapa, cuatro luces y three.js incrustado para funcionar sin conexión. Pero los paneles tapan media escena, las etiquetas se pisan y las fichas tienen datos inventados: una figura de «El Descubridor» que «señala La Meca» sobre la Puerta de la Justicia, Carlos V «erigido entre 1527 y 1537», Santa María como «la referencia más reconocible». |
| [AIF](AIF/juicio.md) | visual | 55 | 4636,5 k | 9 | 203 elementos de Web Reactiva | Mesa libre donde se suelta un elemento sobre otro, 203 elementos y 199 recetas todos alcanzables, sacados de varias páginas de webreactiva.com: agentes, skills, SDD con OpenSpec y Spec Kit, MCP, costes de tokens, seguridad y la capa de marca (Dani Primo, Zona y Atlas Malandriner, En pantuflas). Pistas, recetario, compartir y guardado. Fuera de las recetas no hay generador. |
| [CCA](CCA/juicio.md) | código | 154 | 14602,0 k | 10 | el carrito más completo | API Fastify sin estado con todo el carrito en Redis y cada mutación atómica en un script Lua, más concurrencia optimista por versión, idempotencia, outbox con worker y grupo de consumidores, rate limiting distribuido, JWT, métricas, Docker Compose para escalar réplicas y una prueba de carga con k6. Compila, pasa 42 tests y, con dos instancias, 40 altas a la vez entran todas sin un conflicto. |
| [PTS](PTS/juicio.md) | texto | 15 | 331,8 k | 7 | un manual, no un post | 3011 palabras con muy buen código (test que se «arregla» afirmando lo contrario, reloj congelado, espera activa en lugar de sleep, xfail con strict=True) y un plan por fases para salir de una suite roja. Pero cambia el tema: el título quita el «a veces», casi todo va de tests en rojo permanente y los intermitentes ocupan una sección. Tres veces más largo que un post, 66 negritas y palabras rotas. |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché).

## Rarezas

**A3D**

- 90 peticiones y 8,8 millones de tokens.
- Montó un proyecto: módulos JS en src/, plantilla, CSS y un build.py que lo junta todo, con three.min.js descargado e incrustado. Entregó también las fuentes.
- Asegura que «la cámara nunca queda dentro de un muro» y que lo verificó en Chromium.

**AIF**

- Leyó la portada, un bucle de páginas de webreactiva.com con curl, su CSS y la propia página de Infinite Craft.
- Se le cuela texto en chino e inglés en la respuesta: «rarezas doradas en la，终 and responsive».
- Corrigió dos fallos propios: había metido la mesa dentro de un <canvas> (sus hijos no se pintan) y el título se solapaba en móvil. Lo probó en Chrome por DevTools a mano.
- 55 peticiones y 4,6 millones de tokens.

**CCA**

- 154 peticiones y 14,6 millones de tokens: el mayor gasto de todo el benchmark en una sola prueba.
- Encontró y corrigió dos fallos reales de ioredis con streams, y los dejó documentados con tests.
- Dejó dist/ y node_modules/ en la entrega.

**PTS**

- Se le cuelan palabras de otro idioma, como a MiniMax M3 en su A3D y su PTS: «todos|scale-targeted», «discoverirse».
- 27 ediciones sobre el borrador y 15 peticiones para un post.
- Frontmatter YAML de blog que nadie pidió.
