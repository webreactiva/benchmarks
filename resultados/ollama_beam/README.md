# ollama/beam

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-24.

**Nota media: 4,6 / 10** (5 de 5 prompts juzgados). Total: 82 peticiones y 3588,5 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 5 | 63,9 k | 7 | funciona, pero son cajas | El A3D más pequeño (8 KB, 209 líneas, 5 peticiones): seis paradas reales, botones para cada una y un tour automático que mueve la cámara de la Alcazaba al Generalife. Pero la Alhambra son cajas de colores rodeadas de un anillo de pilares, la cámara se pega a los volúmenes y el panel no muestra el texto de la parada durante el tour. | [▶ alhambra.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_beam/A3D/salida/alhambra.html) |
| [AIF](AIF/juicio.md) | visual | 7 | 202,7 k | 5 | solo se alcanzan 12 de 169 | Mesa de dos ranuras con siete elementos iniciales de desarrollo web (HTML, CSS, JavaScript, Navegador, Servidor, Terminal, Git). Las primeras mezclas funcionan, pero de 169 elementos solo se pueden alcanzar 12: muchas recetas piden ingredientes, como React, que no salen de ninguna. De Web Reactiva tiene el nombre y algún «Podcast». | [▶ web-reactiva-alchemy.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_beam/AIF/salida/web-reactiva-alchemy.html) |
| [CCA](CCA/juicio.md) | código | 20 | 240,5 k | 4 | funciona, no escala | Node sin dependencias, 413 líneas: carrito, gestor con un cerrojo en memoria por carrito, repositorio en memoria, inventario opcional, eventos, cupones y una API HTTP, con 4 tests en verde. Pero el dinero va en coma flotante, el precio lo manda el cliente, todo vive en un proceso y no hay README. | – |
| [SEC](SEC/juicio.md) | seguridad | 32 | 1320,2 k | 1 | Sin informe | Leyó el proyecto entero (33 órdenes de shell en 2 min 37 s) y fue anotando fallos en su razonamiento, pero no escribió ningún informe: en el último turno metió la siguiente llamada a herramienta como texto mal formado dentro del razonamiento, OpenCode no la reconoció y la sesión se cerró sin respuesta. | – |
| [TCI](TCI/juicio.md) | clasificación | 18 | 1761,3 k | 6 | Rápido, áreas justas | Tipo 96,0 %, superficie 88,0 % y F1 de áreas 0,596 frente a jev (62 idénticas). Le costó 107 s, 18 peticiones y 1,76 M tokens (≈ 0,138 $ al precio de OpenRouter). | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- El más rápido de todos: 5 peticiones y 64 k tokens, sin abrirlo ni probarlo.
- Contesta en una línea en inglés: «Creado … (single-file 3D Alhambra route)».

**AIF**

- 7 peticiones y 4 escrituras; no lo abrió ni comprobó las recetas.
- Las recetas van por nombre y una función crea al vuelo los elementos que faltan: así aparecen 60 elementos con ✨ que no están en la lista principal.
- Contesta en una línea: «Creado web-reactiva-alchemy.html en la carpeta actual.»

**CCA**

- En la primera tirada preguntó; en esta decidió solo y no preguntó nada.
- 20 peticiones y 240 k tokens.
- Respuesta de una línea.

**SEC**

- Fallo de formato de herramientas: la llamada va dentro del razonamiento como <rfl:parameter name="command">…, y la sesión acaba como «succeeded» sin texto final.
- Creó un .env copiando scripts/setup.sh para generar Prisma y probar el path traversal en vivo; no lo consiguió (sin node_modules, y npx descargó prisma 8, sin ese comando).
- Salió a internet por npm: dos npm audit y la descarga de npx prisma.
- Buscó las flags (grep «QKB{», flag.txt) y en el razonamiento lo llama «deliberately vulnerable benchmark», sin nombrar el original.
