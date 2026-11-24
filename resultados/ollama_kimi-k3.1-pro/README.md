# ollama/kimi-k3.1-pro

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-20.

**Nota media: 8,3 / 10** (3 de 5 prompts juzgados). Total: 59 peticiones y 2897,4 k tokens.

Pendientes: SEC, TCI.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 23 | 1008,0 k | 10 | el mejor A3D, sin librerías | Una maqueta 3D con motor propio, sin three.js ni nada externo, que se reconoce (murallas almenadas, Alcazaba, Carlos V con su patio circular, los patios nazaríes con su fuente, el Generalife entre cipreses) y un recorrido de 6 paradas que lleva la cámara de una a otra sin atravesar nada. Diseño de guía turística: itinerario con tiempos, fichas, plano, atardecer, historia y consejos. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_kimi-k3.1-pro/A3D/salida/index.html) |
| [AIF](AIF/juicio.md) | visual | 25 | 1714,8 k | 9 | pulido y de Web Reactiva | Contenido sacado de cuatro páginas de webreactiva.com (Malandriner, En pantuflas, Claude Code, Skills, MCP, SDD, «Deploy en viernes»), 98 elementos todos alcanzables, rangos («Aprendiz en pantuflas»), hitos, pistas, bitácora y una interfaz de producto. Mesa libre donde se combina soltando una ficha sobre otra. No es infinito: las mezclas sin receta dan un mensaje. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_kimi-k3.1-pro/AIF/salida/index.html) |
| [CCA](CCA/juicio.md) | código | 11 | 174,6 k | 6 | correcto, pero no escala | Una clase Carrito en Python, limpia y bien validada (Decimal, una moneda por carrito, precio y stock del catálogo, 17 tests), pero sin servicio, sin persistencia y sin nada que responda a «escalable»: el carrito vive en un objeto en memoria y no hay README que lo explique. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- El único A3D sin librerías: ni three.js ni CDN, funciona sin conexión.
- Organizó el trabajo con una lista de tareas (todowrite) y lo probó en varias resoluciones.
- 23 peticiones y 1 millón de tokens.

**AIF**

- 5 lecturas web, una de ellas el logo de la web (que luego no usó: dibujó el suyo).
- Recorrió las 94 combinaciones en Chrome para comprobar el juego entero.
- 25 peticiones y 1,7 millones de tokens.

**CCA**

- El más corto de todos los CCA: 11 peticiones y 175 k tokens. Entiende «escalable» como catálogo inyectable.
- Dejó __pycache__ en la entrega.
