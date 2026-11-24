# gpt-6.2-astra (default)

Agente: Codex CLI. Fechas: 2026-11-20 a 2026-11-20.

**Nota media: 6,0 / 10** (3 de 5 prompts juzgados). Total: 19 peticiones y 433,1 k tokens.

Pendientes: SEC, TCI.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 5 | 111,6 k | 6 | maqueta limpia, la cámara no viaja | Una maqueta en 3D hecha a mano en canvas, sin librerías y en 8 KB, con torres almenadas y el patio circular de Carlos V, y una ruta de cinco paradas reales con textos correctos. Pero «Siguiente parada» solo cambia el texto: la cámara se queda quieta, así que la ruta no se recorre. | [▶ alhambra.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6.2-astra-default/A3D/salida/alhambra.html) |
| [AIF](AIF/juicio.md) | visual | 5 | 129,8 k | 8 | pequeño, completo y de la casa | Un juego de casillas con 35 elementos y 32 recetas, todos alcanzables, con contenido reconocible de Web Reactiva (Zona Malandriner, En pantuflas, Atlas MCP) sin haber consultado la web. Guarda, busca y da pistas en 9 KB, pero no hay lienzo libre y las mezclas sin receta no dan nada. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6.2-astra-default/AIF/salida/index.html) |
| [CCA](CCA/juicio.md) | código | 9 | 191,7 k | 4 | maqueta de carrito, sin escalar | Una página de carrito bien acabada con cuatro láminas, envío gratis desde 75 € y persistencia en localStorage que valida lo que lee. No hay tests, ni servidor, ni README: «escalable» se queda en que el catálogo es una lista que se puede ampliar. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Lo escribe todo en cinco peticiones y cuatro llamadas, sin abrirlo en un navegador
- Programa su propio motor 3D (caras, orden de pintado y proyección) en lugar de usar three.js

**AIF**

- No consulta webreactiva.com: el contenido sale de lo que ya sabe
- Cinco peticiones y cuatro llamadas; no lo abre en un navegador
- Dibuja la cabecera con matraces en pixel art a mano en un canvas

**CCA**

- Descarga cuatro fotos de Unsplash con curl (y una quinta que luego borra)
- Solo comprueba la sintaxis con node --check
- Escribe los ficheros con una función propia que guarda en su memoria entre llamadas (store/load)
