# ollama/muse-spark-open

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-20.

**Nota media: 8,0 / 10** (4 de 4 prompts juzgados). Total: 41 peticiones y 1109,7 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 5 | 88,0 k | 7 | bonita por fuera, cámara perdida | Interfaz muy cuidada (Cinzel, fichas con datos, progreso, minimapa, leyenda, día y noche) y 7 paradas con textos correctos, y el recorrido automático avanza. Pero la escena está tan a escala que la cámara va siempre pegada a los volúmenes, hasta en «vista aérea», y al saltar de parada con «Siguiente» la consola se llena de errores (unos 150, uno por fotograma). | [▶ alhambra-ruta-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_muse-spark-open/A3D/salida/alhambra-ruta-3d.html) |
| [AIF](AIF/juicio.md) | visual | 9 | 391,6 k | 8 | muy de la casa, rama de IA bloqueada | Contenido sacado de cuatro páginas de webreactiva.com con mucho humor de la casa («Combustible oficial del developer. 100 % malandriner», «Dirigible (400 € en tokens)»), mesa libre donde se combina soltando una ficha sobre otra, filtros, pistas y recetas secretas. Pero una receta posterior (IA + Código = Python) pisa a la que anuncia como clave (Código + IA = Prompt): sin Prompt no se puede llegar a agentes, skills, MCP, Claude Code ni SDD. Solo 68 de 102 alcanzables, y el botón «Combinar» no registra nada. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_muse-spark-open/AIF/salida/index.html) |
| [CCA](CCA/juicio.md) | código | 24 | 603,7 k | 9 | bien pensado, sin Redis | Python sin dependencias: agregado de carrito con límites, motor de precios con reglas (por volumen, categoría, cupón), IVA y envío, reserva de stock, bus de eventos, servicio sin estado con versión optimista y reintentos, almacenamiento en memoria, en fichero o repartido en shards, y una API REST. Pasa 12 tests y 50 hilos no pierden nada. Pero Redis o DynamoDB son solo un contrato. | – |
| [PTS](PTS/juicio.md) | texto | 3 | 26,3 k | 8 | limpio y corto, se va al rojo fijo | 444 palabras directas y con muy poco slop (0,45 por cada 100 palabras): la tesis en dos frases (sin tests sabes que estás desprotegido; con tests rojos que ignoras crees que estás cubierto), dos imágenes que funcionan (la alarma del coche, quitar la pila al detector de humo), la salida de `npm test` con «3 failed» y cuatro reglas. Pero arranca con tests que «fallan constantemente» y apenas toca los que fallan a veces, y es corto para un post. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- 5 peticiones: lo escribió de una vez, sin probarlo.
- Promete «124 columnas + 12 leones» modelados; desde la cámara no se ven.

**AIF**

- Presume en la respuesta y en el propio juego de «Prompt = Código + IA» como receta secreta, y es justo la que no funciona.
- Dejó un parche que «arregla» recetas rotas cambiándolas por humo en vez de corregirlas.
- 9 peticiones y 4 lecturas de la web.

**CCA**

- Ofrece dos API: una con la librería estándar y otra con FastAPI.
- 24 peticiones y 604 k tokens.
- Dejó __pycache__ en la entrega.

**PTS**

- 3 peticiones y 1,2 k tokens de salida: el post más barato del benchmark.
