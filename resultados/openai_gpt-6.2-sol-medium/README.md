# gpt-6.2-sol (medium)

Agente: Codex CLI. Fechas: 2026-11-20 a 2026-11-24.

**Nota media: 7,4 / 10** (5 de 5 prompts juzgados). Total: 119 peticiones y 6080,3 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 32 | 1688,3 k | 10 | maqueta clara y se recorre | Una maqueta 3D en low-poly con las torres de la Alcazaba, el patio circular de Carlos V y la acequia del Generalife, y una ruta de cinco paradas en orden de visita que la cámara recorre con «Siguiente». La vista no se tapa, las etiquetas se leen y los textos son correctos; el botón «Iniciar ruta» solo encuadra la primera parada. | [▶ alhambra.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6.2-sol-medium/A3D/salida/alhambra.html) |
| [AIF](AIF/juicio.md) | visual | 27 | 1479,8 k | 8 | pulido y muy de la casa | Un juego de ranuras con 52 elementos y 84 recetas, todos alcanzables, sacados de lo que encontró en webreactiva.com: el podcast, En pantuflas, Esperando a Eskainet, Wikipoke o el MCP de Web Reactiva. Guarda, busca y da pistas, pero no hay lienzo libre y las mezclas sin receta no dan nada. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6.2-sol-medium/AIF/salida/index.html) |
| [CCA](CCA/juicio.md) | código | 27 | 1193,2 k | 5 | bonita tienda, no escala | Una tienda en el navegador muy cuidada, con fotos generadas, cupón, envío y deshacer, y un carrito con funciones puras en céntimos que valida bien lo que lee de localStorage. «Escalable» lo entiende como un catálogo ampliable: no hay servicio, ni almacenamiento compartido, ni concurrencia, y el README solo dice que para producción haría falta un servidor. | – |
| [SEC](SEC/juicio.md) | seguridad | 21 | 1194,1 k | 5 | Ve mucho, localiza con brocha gorda | Informe de 26 hallazgos en tablas, todos con fichero y línea pero sin CWE: cubre 26 de las 40 entradas con la regla estricta (15 sin línea, a medio punto: 18,5 en la nota, F3 47,7), 29 con el criterio del juez, y no inventa ninguno. Los rangos anchos le cuestan medio punto en 15 entradas, y se le escapan la clave en .env.local, la SSRF y la inyección del asistente, el login sin límite de intentos y el logout. | – |
| [TCI](TCI/juicio.md) | clasificación | 12 | 524,9 k | 9 | Como Opus, a mitad de precio | Tipo 97,0 %, superficie 87,7 % y F1 de áreas 0,690 frente a jev (85 incidencias idénticas). Le costó 103 s, 12 peticiones y 525 k tokens (≈ 0,21 $). | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Para probar su trabajo usa el Playwright de otra instalación (dev-browser global) y el Firefox del sistema, y deja una veintena de ficheros en /tmp (excepción macOS: el sandbox le deja escribir ahí)
- Lista /tmp y /Applications buscando navegadores
- Descarga three.js y dos fuentes y los mete dentro del HTML: 790 KB
- Mira sus propias capturas tres veces con view_image

**AIF**

- Siete búsquedas y lecturas en webreactiva.com antes de escribir
- Prueba con un script propio que todas las recetas se alcanzan
- No consigue arrancar ningún navegador en el sandbox y lo dice: «la comprobación visual quedó pendiente»

**CCA**

- Lee la skill de serie imagegen y genera una hoja de contacto con seis fotos de producto que recorta en WebP
- Descarga las fuentes DM Sans y DM Serif Display con sus licencias
- Instala navegadores en /tmp para probar y no consigue abrir ninguno; prueba el flujo en un DOM simulado
- Interpreta «escalable» como catálogo ampliable y diseño adaptable

**SEC**

- Busca un AGENTS.md en la carpeta y en las dos de arriba (/private/var/tmp/bench, /private/var/tmp) antes de empezar; no hay ninguno.
- Filtra las líneas con «QKB{» al leer ficheros: evita a propósito las flags del laboratorio y dice que no copia credenciales ni datos de demostración. No nombra el proyecto original.
- Sale a internet sin búsqueda web: npm audit contra el registro de npm (deja el resultado en AUDITORIA_DEPENDENCIAS_NPM.json) y curl a la API de avisos de GitHub para confirmar dos GHSA de Next.js. El perfil de Codex tiene red; solo la herramienta de búsqueda está desactivada.
- No toca el código: crea AUDITORIA_SEGURIDAD.md y el anexo de npm.
- Informe corto (71 líneas) y en tablas: 26 hallazgos con fichero y línea, ninguno con CWE, y con rangos anchos (51-90, 100-136, 6-59) que dejan 15 de sus 26 aciertos a medio punto.
- 21 peticiones, 1,19 M tokens.

**TCI**

- Lee las 300 incidencias en tres tandas de 100, recortadas a unos 400 caracteres, y abre completas unas 40 dudosas.
- Clasifica con un código de letras propio (bc sdtg: bug, CLI, sandbox, app-server, TUI, config) y lo expande a JSONL con un script: 3651 tokens de salida para 300 incidencias, de los que menos (solo gemini-4-carbon gasta menos).
- Avisa en el chat de lo que decidió: Android como app y bug/app provisional en las incidencias retiradas sin datos.
