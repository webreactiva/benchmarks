# SEC · claude-fable-5-2 · 7/10

**Casi completo, sin CWE**

## Validación

<!-- cifras -->
| | Nota (estricto) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 25,5 (23 con línea, 5 sin línea a medio punto) | 38 |
| F3 | 63,2 | 95,5 |
| wF3 | 64,3 | |
| Falsos positivos | 18 (incluye 14 fallos reales sin etiquetar) | 0 inventados |

Rúbrica: F3 5/7, críticas 1 (6 de 6), fichero y línea 1 (93 % de los hallazgos), CWE 0 (0 %). **Nota: 7/10.**
<!-- /cifras -->

Cruce a mano de los 40 hallazgos de `salida/AUDITORIA_SEGURIDAD.md` con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Cada hallazgo sin entrada se comprobó en el código de la copia.

## Lo que está bien

- Ve casi todo: las cinco SQLi, XXE, las dos SSRF, path traversal, los dos IDOR, alta como ADMIN, JWT con secreto por defecto, clave AES fija y el oráculo de los mensajes de error de `documents/share`, credenciales del SIEM y contraseñas en el log, XSS de analytics y de reseñas, open redirect, fuerza bruta y enumeración en el login, API de flags pública y token de diagnóstico.
- Cubre las seis entradas críticas (dos a medio punto) y da fichero y línea en el 93 % de los hallazgos, con la cadena de explotación y una corrección concreta para cada uno.
- Ningún hallazgo inventado: los 14 que no tienen entrada son fallos reales (reset predecible, middleware sin firma, carrera en cupones, tarjetas regalo, directo secuestrable, `/internal` por cabecera, MCP con sesión constante, dependencias vulnerables según `npm audit`), aunque la regla estricta los cuente como falsos positivos.

## Lo que falta o está mal

- No cubre la fuga de la URL interna y las herramientas en la respuesta del asistente de IA (011) ni el token de soporte guardado en claro (034).
- Varias líneas exactas caen fuera de ±10 por poco: la lectura de `/api/files` (cita 49, la entrada es 62), la SQLi de pedidos (cita la interpolación en 81, la entrada es la ejecución en 102), el token devuelto por `support-access` (cita 58, la entrada es 90). Igual con la subida de SVG, la exportación, `/news`, el MD5 del reset y las dos inyecciones de prompt y la SSRF del asistente: valen para el juez, no para la nota.
- Ningún CWE.

## Rarezas de la sesión

- Dice que el proyecto parece una aplicación «deliberadamente vulnerable (laboratorio/CTF)» por la tabla flags, flag.txt y las cadenas QKB{…}; no nombra el proyecto original.
- Sale a internet una vez: ejecuta npm audit --omit=dev, que consulta el registro de npm (WebSearch y WebFetch estaban denegados, pero el registro es accesible). De ahí salen los 21 avisos y los GHSA de C-09.
- No toca el código: solo crea AUDITORIA_SEGURIDAD.md y lo corrige una vez con Edit (49 → 52 rutas API tras contarlas). Sin subagentes, 15 peticiones.
- Sus líneas son precisas pero tres caen justo fuera de la ventana: files:49 (la lectura está en 62), orders/search:81 (la ejecución en 102) y support-access:58 para el token devuelto (línea 90).
- La pantalla final muestra en la caja de entrada la sugerencia de Claude Code «corrige los hallazgos críticos»; no se envió.
