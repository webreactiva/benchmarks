# gpt-6.2-astra (medium)

Agente: Codex CLI. Fechas: 2026-11-20 a 2026-11-24.

**Nota media: 6,2 / 10** (5 de 5 prompts juzgados). Total: 42 peticiones y 1286,6 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 4 | 94,6 k | 6 | maqueta bonita, la cámara no viaja | Una maqueta 3D hecha a mano en canvas, más trabajada que con el esfuerzo por defecto, con una ruta de seis paradas reales y textos correctos. Pero repite el fallo: «Siguiente parada» no mueve la cámara, así que la ruta no se recorre. | [▶ alhambra.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6.2-astra-medium/A3D/salida/alhambra.html) |
| [AIF](AIF/juicio.md) | visual | 3 | 67,3 k | 7 | se juega, Web Reactiva a medias | Un juego de mesa de mezclas con 36 elementos y 32 recetas, todos alcanzables, que guarda, busca y da pistas. Lo de Web Reactiva se queda en Zona Malandriner, Top Malandriner, el podcast premium y la newsletter: el resto es frontend, backend, API y framework, y las mezclas sin receta no dan nada. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6.2-astra-medium/AIF/salida/index.html) |
| [CCA](CCA/juicio.md) | código | 8 | 177,8 k | 4 | tienda de café, sin escalar | Una página de carrito cuidada para una tienda de café, con fotos generadas, guardar para después y envío gratis desde 60 €, que valida lo que lee de localStorage. No hay tests, ni servidor, ni README: «escalable» es que el catálogo es una lista ampliable. | – |
| [SEC](SEC/juicio.md) | seguridad | 14 | 470,1 k | 5 | Amplio y preciso, líneas de entrada | Informe de 20 hallazgos, todos con fichero y una línea concreta, sin CWE y ninguno inventado: cubre 16 de las 40 entradas, todas con línea (F3 41,9), 23 con el criterio del juez. Ve casi todo lo grave, pero cita la primera línea de la función: cuatro SQLi, la SSRF del asistente y la lectura de archivos caen fuera de la ventana de ±10. | – |
| [TCI](TCI/juicio.md) | clasificación | 13 | 476,8 k | 9 | Bien clasificado, una vuelta de más | Tipo 96,3 %, superficie 88,7 % y F1 de áreas 0,692 frente a jev (82 incidencias idénticas). Le costó 102 s, 13 peticiones y 477 k tokens (≈ 0,57 $): las peticiones pasan de 10. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Tres llamadas y cuatro peticiones; no lo abre en un navegador
- Se programa su propio motor 3D en lugar de usar three.js

**AIF**

- Dos llamadas y tres peticiones: lo escribe de un tirón
- No consulta webreactiva.com

**CCA**

- Lee la skill de serie imagegen y genera tres fotos de producto, que convierte a WebP con sips y cwebp
- Comprueba cálculos y persistencia con un script propio, pero no deja tests

**SEC**

- Busca con rg las palabras «vulnerab» e «intentionally» para saber si el proyecto se declara vulnerable a propósito. No nombra el proyecto original.
- Sale a internet sin búsqueda web: npm audit contra el registro de npm, que deja en auditoria-dependencias.json. La herramienta de búsqueda estaba desactivada; la red, no.
- Cita siempre una sola línea, la de entrada de la función: en las SQLi de productos, pedidos y reseñas cae a 5-20 líneas de la consulta y queda fuera de la ventana.
- No toca el código. 14 peticiones y 470 k tokens, con 13 órdenes de shell.

**TCI**

- Lee las 300 por tandas con un script que saca de cada plantilla las respuestas (175 caracteres) o los primeros 360 del texto, y abre completas 29 dudosas.
- Anota cada incidencia en una línea de códigos (C = CLI, A = app, E = enhancement, t = TUI, cfg = config…) y la expande a JSONL con un script; corrige a mano cuatro filas antes de escribir: 2947 tokens de salida.
- Más caro que astra con el esfuerzo por defecto: 13 peticiones y 477 k tokens frente a 7 y 190 k, con la misma calidad.
