# ollama/mistral-large-4

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-24.

**Nota media: 5,4 / 10** (5 de 5 prompts juzgados). Total: 56 peticiones y 2371,8 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 10 | 133,6 k | 2 | se recorre, entre muros | Ruta guiada con three.js por ocho paradas de los palacios nazaríes al Generalife, con lista, fichas, vuelo libre y velocidad hasta 4×; la cámara viaja de una a otra y el recorrido vuelve a empezar. Pero casi todas las vistas acaban pegadas a un muro, solo se reconocen murallas y torres, y una ficha se equivoca con el nombre de la Sala de las Dos Hermanas. | [▶ alhambra-ruta-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_mistral-large-4/A3D/salida/alhambra-ruta-3d.html) |
| [AIF](AIF/juicio.md) | visual | 9 | 267,2 k | 6 | funciona, sin Web Reactiva | Juego de combinar con 268 elementos y 264 recetas, todos alcanzables desde Computadora, Internet, Electricidad y Papel, con pista, buscador y guardado. Pero se combina seleccionando dos fichas en vez de soltar una sobre otra, las mezclas sin receta no dan nada y el contenido es desarrollo web genérico: de Web Reactiva solo queda el nombre, como Podcast + Comunidad. | [▶ reactiva-craft.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_mistral-large-4/AIF/salida/reactiva-craft.html) |
| [SEC](SEC/juicio.md) | seguridad | 14 | 567,1 k | 5 | Cruce sólido, forma descuidada | Informe de 39 hallazgos en el que el juez reconoce 32 de las 40 entradas, pero la nota cuenta 22 (F3 54,5): ocho entradas valen medio acierto por ir sin línea o con rangos de más de 20, y ocho hallazgos no se sostienen como fallo. Se le escapan el oráculo de padding (lo menciona y lo descarta), el open redirect del login, el logout, el token de soporte en claro y en la respuesta, el total del pedido, la fuga de herramientas del asistente y la página de noticias; además pierde los puntos de línea y CWE. | – |
| [CCA](CCA/juicio.md) | código | 9 | 190,5 k | 8 | sólido en un proceso | Librería Python sin dependencias, hexagonal, con dinero en céntimos, una moneda por carrito, precio del catálogo, descuentos e impuestos enchufables, eventos de dominio, límites y repositorio en memoria o SQLite; 24 tests y una demo que funcionan, y 50 altas a la vez con un servicio no pierden nada. Pero la concurrencia depende de un cerrojo del proceso: con dos servicios sobre el mismo SQLite se pierden 3 de 50 altas sin aviso. | – |
| [TCI](TCI/juicio.md) | clasificación | 14 | 1213,4 k | 6 | Bien, el más lento | Tipo 97,0 %, superficie 87,7 % y F1 de áreas 0,613 frente a jev (71 idénticas). Le costó 424 s, 14 peticiones y 1,21 M tokens (≈ 0,24 $ al precio de OpenRouter). | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Ollama Cloud cortó tres de sus peticiones (dos ECONNRESET y un 504 Gateway Timeout, todas hacia los 5 minutos); OpenCode las reintentó y la sesión terminó. meta.json guarda el último error («Gateway Timeout») aunque el trabajo se completó.
- Escribió el fichero, dijo que tenía un error de sintaxis y lo reescribió entero; luego tres edit y una comprobación de sintaxis con python + node. No lo abrió en un navegador.
- 10 peticiones y 134 000 tokens, en unos 40 minutos por los reintentos.

**AIF**

- No intentó buscar nada sobre Web Reactiva: lo resolvió con un elemento «Web Reactiva» y una fanfarria al crearlo.
- Validó con node que no hubiera recetas duplicadas ni ingredientes huérfanos y que todo fuera alcanzable.
- 9 peticiones y 267 000 tokens.

**SEC**

- No nombra el proyecto original (OopsSec, RealVuln); lo llama Quokka Bazaar y trata las flags QKB{…} como secretos a rotar.
- No sale a internet ni ejecuta comandos: 80 read, 6 grep, 1 glob y 1 write, sin shell. El CVE-2025-55182 de Next lo cita de memoria, sugerido por la variable FLAG_CVE_2025_55182 de .env.local.
- Copia en la sección de secretos los valores QKB{…} de .env.local, flag.txt, notice.txt, supplier-registry.txt y del system prompt del asistente.
- Se le cuelan palabras en otros idiomas en el informe: «限制 entity expansion», «代替 de la cabecera» y «Any token con 3 partes».
- Los seis hallazgos de la sección B no dan CWE y quince hallazgos van sin línea (C-7, C-16, A-4, A-9, M-2 a M-7, B-1, B-2, B-4 a B-6): pierde los dos puntos de forma.
- Deja un solo fichero (security-audit-report.md) y no toca el código. Sin errores, subagentes ni compactaciones; termina en 3 min 40 s.

**CCA**

- El primer unittest no cargó por un nombre de test con un espacio; lo arregló y pasaron los 24.
- Probó la demo con SQLite en /tmp/opencode, fuera de su carpeta (dentro del encierro).
- Entrega las carpetas __pycache__ junto al código.
- 9 peticiones y 190 000 tokens.
