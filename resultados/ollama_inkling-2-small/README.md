# ollama/inkling-2-small

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-23.

**Nota media: 7,5 / 10** (4 de 5 prompts juzgados). Total: 95 peticiones y 3785,7 k tokens.

Pendientes: TCI.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 24 | 1202,2 k | 9 | bonita y se recorre | Maqueta clara del cerro de la Sabika con muralla, Alcazaba con bandera, Comares, Generalife con su alberca, Albaicín, el Darro y Sierra Nevada, 9 paradas con textos correctos y un recorrido automático que viaja de verdad. Pero al bajar a los patios la cámara se mete en los muros, y Comares sale como una torre redonda con cúpula. | [▶ alhambra-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_inkling-2-small/A3D/salida/alhambra-3d.html) |
| [AIF](AIF/juicio.md) | visual | 15 | 688,7 k | 9 | se juega, Web Reactiva a medias | Mesa libre con fichas que se combinan soltando una sobre otra, 125 elementos todos alcanzables y un generador para las mezclas sin receta. Parte de Agua, Fuego, Aire y Tierra y mezcla programación genérica (React, Rust, Docker) con algo de Web Reactiva (podcast, masterclass, «Maratón WR», «Membresía WR», «Slow Content»), sin mirar la web. | [▶ alquimia-reactiva.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_inkling-2-small/AIF/salida/alquimia-reactiva.html) |
| [CCA](CCA/juicio.md) | código | 40 | 1042,4 k | 9 | bien diseñado, sin Redis | API Fastify sin estado en TypeScript, con capas y puertos, dinero en céntimos, precio del catálogo, cupones, IVA, envío, caducidad de carritos y compare-and-set por versión en el repositorio. Compila, pasa 21 tests y 50 altas a la vez no pierden nada. Pero solo trae repositorios en memoria: Redis o Postgres quedan como «pendiente». | – |
| [SEC](SEC/juicio.md) | seguridad | 16 | 852,4 k | 3 | Ve mucho, no localiza | Informe de 46 hallazgos que, a juicio, cubre 32 de las 40 entradas y solo tiene 6 que no son fallos, pero casi nunca da línea: la nota cuenta 2 aciertos enteros y 28 a medio punto (F3 40,1). Se le escapan el oráculo de padding, las credenciales del seed, la fuga de la URL del asistente, el logout, la página de noticias y, como hallazgo, la SQLi de admin/reviews. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Lo probó en Chrome headless en varias paradas y lo retocó con 11 ediciones.
- Buscó navegadores (chromium, puppeteer, playwright) para probarlo; corría encerrado y solo vio lo del sistema.
- 24 peticiones y 1,2 millones de tokens, sin compactaciones.

**AIF**

- Dice «no puedo ver imágenes en este modelo» y comprueba la captura por el DOM. El modelo sí acepta imágenes: es nuestra configuración de OpenCode, que no declara qué entradas admite cada modelo.
- No consultó la web para el contenido.
- 15 peticiones y 689 k tokens.

**CCA**

- Preguntó con la herramienta de preguntas (stack: Node/TS, Python/FastAPI o Java/Spring; alcance) y el lanzador le contestó «Decide tú.». Eligió lo que marcaba como recomendado.
- Hizo un smoke test del flujo completo (crear, añadir, cupón, checkout) contra el servidor.
- 40 peticiones y 1 millón de tokens.

**SEC**

- Ejecuta npm audit y lo consigue: sale al registro de npm pese a correr sin web (webfetch y websearch estaban denegados, el shell no).
- Vuelca todas las rutas API a /tmp/opencode/api-routes.txt, fuera de la carpeta de trabajo, para leerlas por trozos.
- No nombra el proyecto original; ve las flags QKB{…} y avisa de que no reproduce sus valores.
- La tabla del resumen dice 8 medios y 6 bajos; el informe trae 10 y 15. Dos de los bajos son controles que están bien (B-12, B-15).
- XXE y open redirect solo aparecen en las cadenas de ataque, sin hallazgo propio; la SQLi de admin/reviews solo en el resumen y en las prioridades.
- Casi no da líneas (3 de 46 hallazgos) ni ningún CWE.
- No toca el código: solo crea SECURITY_AUDIT.md. 16 peticiones, 2 min 9 s.
