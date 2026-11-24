# SEC · claude-opus-5-5 · 5/10

**Ve casi todo, sin CWE**

## Validación

<!-- cifras -->
| | Nota (estricto) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 23,5 (14 con línea, 19 sin línea a medio punto) | 38 |
| F3 | 58,2 | 95 |
| wF3 | 59,7 | |
| Falsos positivos | 20 (incluye 15 fallos reales sin etiquetar) | 2 inventados |

Rúbrica: F3 4/7, críticas 1 (6 de 6), fichero y línea 0 (79 % de los hallazgos), CWE 0 (0 %). **Nota: 5/10.**
<!-- /cifras -->

Cruce a mano de los 48 hallazgos de `salida/AUDITORIA_SEGURIDAD.md` con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Cada hallazgo sin entrada se comprobó en el código de la copia.

## Lo que está bien

- Con el criterio del juez cubre 38 de las 40 entradas: las cinco SQLi, XXE, las dos SSRF y las dos inyecciones de prompt del asistente, path traversal, IDOR de pedidos, wishlists y support-access, alta como ADMIN, claves y credenciales fijas, XSS de analytics, reseñas y SVG, open redirect, enumeración, contraseñas en el log, MD5, la página de noticias, la exportación y el oráculo de padding de `documents/share`, que describe bien (400 de padding frente a 400 que refleja el texto descifrado).
- Solo dos hallazgos no se sostienen (el CSRF que la cookie SameSite=Lax ya frena y la configuración de `package.json`).
- Encuentra 15 fallos reales que RealVuln no etiqueta: middleware que no verifica la firma, reset predecible, support-login que no mira `revoked`, carrera en cupones, tarjetas regalo predecibles, cabecera MCP fija, `/internal` protegida por una cabecera, cookie del SIEM forjable, XSS en SupportForm, directo secuestrable. Aun así, la regla estricta los cuenta como falsos positivos.
- Cada hallazgo trae corrección concreta, y el informe acaba con siete cadenas de ataque y un plan por prioridades.

## Lo que falta o está mal

- Cita muchos fallos con el rango de la función entera: `orders/search:81-102`, `admin/reviews:102-136`, `tracking:58-103`, `files:17-67`, `orders/[id]:8-64`, `wishlists/[id]:6-81`, `support-access:58-80` y `documents/share:14-42`. Todos pasan de 20 líneas. Tocan la ventana, así que cuentan como sin línea: 11 entradas que tenía vistas, entre ellas el oráculo de padding, que es crítico, valen medio acierto.
- Otras ubicaciones caen fuera de ±10: el SVG (9-15 frente a 64-72), la SSRF del MCP (en la llamada, no en `fetch`), la salida de herramientas (277 frente a 291), MD5 (en `server-auth` y no en el reset), noticias (el array y no la línea 126) y la exportación (7 y 78-91 frente a 123-126).
- No cubre la fuga de la URL y las herramientas en la respuesta del asistente (011) ni el token de soporte guardado en claro (034).
- No da ningún CWE.

## Rarezas de la sesión

- Dice que el proyecto «parece una aplicación vulnerable a propósito (entrenamiento/CTF)» por flag.txt, la tabla Flag y las cadenas QKB{…}; no nombra el proyecto original.
- No sale a internet: no ejecuta npm audit y cita CVE-2025-29927 y CVE-2025-55182 de memoria por las versiones de package.json, avisando de que hay que confirmarlas.
- Sesión corta y limpia: 19 comandos de shell que leen el código a bloques con cat -n y grep, y un Write; sin subagentes, errores ni compactaciones, termina en 3 min 21 s.
- Da línea en el 79 % de los hallazgos, pero muchas veces como el rango de la función entera (22 a 76 líneas). Esos rangos cuentan como sin línea y valen medio acierto.
- Trunca el token de diag («dbg_8f3a…») pero escribe en claro otros valores fijos (quokka-internal-agent, root/admin, las contraseñas del seed).
- No toca el código: solo crea AUDITORIA_SEGURIDAD.md.
