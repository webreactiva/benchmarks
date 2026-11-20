# ollama/kimi-k3.1-pro

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-20.

**Nota media: 8,8 / 10** (4 de 4 prompts juzgados). Total: 63 peticiones y 2939,8 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio |
|---|---|---:|---:|---:|---|---|
| [A3D](A3D/juicio.md) | visual | 23 | 1008,0 k | 10 | el mejor A3D, sin librerías | Una maqueta 3D con motor propio, sin three.js ni nada externo, que se reconoce (murallas almenadas, Alcazaba, Carlos V con su patio circular, los patios nazaríes con su fuente, el Generalife entre cipreses) y un recorrido de 6 paradas que lleva la cámara de una a otra sin atravesar nada. Diseño de guía turística: itinerario con tiempos, fichas, plano, atardecer, historia y consejos. |
| [AIF](AIF/juicio.md) | visual | 25 | 1714,8 k | 9 | pulido y de Web Reactiva | Contenido sacado de cuatro páginas de webreactiva.com (Malandriner, En pantuflas, Claude Code, Skills, MCP, SDD, «Deploy en viernes»), 98 elementos todos alcanzables, rangos («Aprendiz en pantuflas»), hitos, pistas, bitácora y una interfaz de producto. Mesa libre donde se combina soltando una ficha sobre otra. No es infinito: las mezclas sin receta dan un mensaje. |
| [CCA](CCA/juicio.md) | código | 11 | 174,6 k | 6 | correcto, pero no escala | Una clase Carrito en Python, limpia y bien validada (Decimal, una moneda por carrito, precio y stock del catálogo, 17 tests), pero sin servicio, sin persistencia y sin nada que responda a «escalable»: el carrito vive en un objeto en memoria y no hay README que lo explique. |
| [PTS](PTS/juicio.md) | texto | 4 | 42,3 k | 10 | el mejor post | 1409 palabras sin salirse de los tests intermitentes, con la tesis defendida desde el principio («una habitación a oscuras» frente a «una alarma que suena al azar»), cuatro costes con mecanismo (oculta regresiones, entrena a ignorar el rojo, agranda los cambios, gasta atención), la cuenta bien hecha (200 tests al 99 % → 87 % de ejecuciones con algún fallo) y un plan práctico. El menos slop de todos. |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché).

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

**PTS**

- 4 peticiones y 3,5 k tokens de salida.
