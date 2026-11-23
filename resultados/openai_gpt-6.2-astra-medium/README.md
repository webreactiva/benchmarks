# gpt-6.2-astra (medium)

Agente: Codex CLI. Fechas: 2026-11-20 a 2026-11-20.

**Nota media: 5,7 / 10** (3 de 4 prompts juzgados). Total: 15 peticiones y 339,7 k tokens.

Pendientes: SEC.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 4 | 94,6 k | 6 | maqueta bonita, la cámara no viaja | Una maqueta 3D hecha a mano en canvas, más trabajada que con el esfuerzo por defecto, con una ruta de seis paradas reales y textos correctos. Pero repite el fallo: «Siguiente parada» no mueve la cámara, así que la ruta no se recorre. | [▶ alhambra.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6.2-astra-medium/A3D/salida/alhambra.html) |
| [AIF](AIF/juicio.md) | visual | 3 | 67,3 k | 7 | se juega, Web Reactiva a medias | Un juego de mesa de mezclas con 36 elementos y 32 recetas, todos alcanzables, que guarda, busca y da pistas. Lo de Web Reactiva se queda en Zona Malandriner, Top Malandriner, el podcast premium y la newsletter: el resto es frontend, backend, API y framework, y las mezclas sin receta no dan nada. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6.2-astra-medium/AIF/salida/index.html) |
| [CCA](CCA/juicio.md) | código | 8 | 177,8 k | 4 | tienda de café, sin escalar | Una página de carrito cuidada para una tienda de café, con fotos generadas, guardar para después y envío gratis desde 60 €, que valida lo que lee de localStorage. No hay tests, ni servidor, ni README: «escalable» es que el catálogo es una lista ampliable. | – |

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
