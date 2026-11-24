# gpt-6.2-astra (default)

Agente: Codex CLI. Fechas: 2026-11-20 a 2026-11-24.

**Nota media: 5,9 / 10** (5 de 5 prompts juzgados). Total: 36 peticiones y 844,6 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 5 | 111,6 k | 4.5 | maqueta limpia, la cámara no viaja | Una maqueta en 3D hecha a mano en canvas, sin librerías y en 8 KB, con torres almenadas y el patio circular de Carlos V, y una ruta de cinco paradas reales con textos correctos. Pero «Siguiente parada» solo cambia el texto: la cámara se queda quieta, así que la ruta no se recorre. | [▶ alhambra.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6.2-astra-default/A3D/salida/alhambra.html) |
| [AIF](AIF/juicio.md) | visual | 5 | 129,8 k | 8 | pequeño, completo y de la casa | Un juego de casillas con 35 elementos y 32 recetas, todos alcanzables, con contenido reconocible de Web Reactiva (Zona Malandriner, En pantuflas, Atlas MCP) sin haber consultado la web. Guarda, busca y da pistas en 9 KB, pero no hay lienzo libre y las mezclas sin receta no dan nada. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6.2-astra-default/AIF/salida/index.html) |
| [SEC](SEC/juicio.md) | seguridad | 10 | 221,4 k | 3 | Preciso pero corto | Informe de 14 hallazgos, todos con fichero y línea exacta y ninguno inventado: cubre 13 de las 40 entradas, todas con línea (F3 34,4), 15 con el criterio del juez. Revisa poco: deja fuera las SQLi de reseñas, los IDOR de pedidos, listas y soporte, el open redirect, las flags, el diag, las contraseñas en el log y las credenciales del seed. | – |
| [CCA](CCA/juicio.md) | código | 9 | 191,7 k | 4 | maqueta de carrito, sin escalar | Una página de carrito bien acabada con cuatro láminas, envío gratis desde 75 € y persistencia en localStorage que valida lo que lee. No hay tests, ni servidor, ni README: «escalable» se queda en que el catálogo es una lista que se puede ampliar. | – |
| [TCI](TCI/juicio.md) | clasificación | 7 | 190,1 k | 10 | Lo mismo con un tercio de tokens | Tipo 96,3 %, superficie 87,0 % y F1 de áreas 0,689 frente a jev (78 incidencias idénticas), la calidad de Opus o Sol. Le costó 92 s, 7 peticiones y 190 k tokens (≈ 0,34 $): cumple las tres marcas de eficiencia, como Haiku y Sonnet. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Lo escribe todo en cinco peticiones y cuatro llamadas, sin abrirlo en un navegador
- Programa su propio motor 3D (caras, orden de pintado y proyección) en lugar de usar three.js

**AIF**

- No consulta webreactiva.com: el contenido sale de lo que ya sabe
- Cinco peticiones y cuatro llamadas; no lo abre en un navegador
- Dibuja la cabecera con matraces en pixel art a mano en un canvas

**SEC**

- Auditoría rápida: 9 órdenes de shell, 10 peticiones y 221 k tokens, sin razonamiento apuntado (esfuerzo por defecto). Busca patrones (queryRawUnsafe, dangerouslySetInnerHTML…) y lee unas pocas rutas; nunca abre admin/reviews, orders/[id], wishlists, support-access, flags ni LoginForm.
- Oculta valores al leer: tapa con sed los secretos de docker-compose y las cadenas de monitoring/auth. No nombra el proyecto original.
- No sale a internet: cita CVE-2025-55182 y CVE-2025-66478 de memoria, con el enlace al aviso de Next.js.
- No toca el código: solo crea AUDITORIA_SEGURIDAD.md (36 líneas, 14 hallazgos en una tabla).

**CCA**

- Descarga cuatro fotos de Unsplash con curl (y una quinta que luego borra)
- Solo comprueba la sintaxis con node --check
- Escribe los ficheros con una función propia que guarda en su memoria entre llamadas (store/load)

**TCI**

- No lee las incidencias enteras: saca con un script los títulos y las respuestas de versión, superficie y sistema operativo de cada plantilla (125 caracteres si no hay plantilla) y abre 36 dudosas a 460 caracteres.
- Escribe las áreas de las 300 en un bloque de letras (w = windows-os, s = sandbox, a = app-server…) y lo expande con un script que comprueba con assert que hay una por id: 2711 tokens de salida.
- Por tokens es el más barato de los GPT, pero Astra cuesta cuatro veces más por token que Sol: 0,34 $ frente a 0,21 $.
