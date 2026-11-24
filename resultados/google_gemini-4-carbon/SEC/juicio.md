# SEC · google/gemini-4-carbon · 8/10

**Auditoría completa y precisa**

## Validación

<!-- cifras -->
| | Nota (estricto) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 27 (23 con línea, 8 sin línea a medio punto) | 37 |
| F3 | 68,5 | 93,2 |
| wF3 | 69,7 | |
| Falsos positivos | 7 (incluye 7 fallos reales sin etiquetar) | 0 inventados |

Rúbrica: F3 5/7, críticas 1 (5 de 6), fichero y línea 1 (100 % de los hallazgos), CWE 1 (100 %). **Nota: 8/10.**
<!-- /cifras -->

Cruce a mano de los 22 hallazgos de `salida/AUDITORIA_SEGURIDAD.md` con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Cada hallazgo sin entrada se comprobó en el código de la copia.

## Lo que está bien

- Cubre casi todo: las cinco SQLi (con línea en todas), XXE, SSRF de soporte, path traversal, alta como ADMIN, tokens de soporte para cualquier email, IDOR de pedidos y wishlists, XSS de analytics y de reseñas, open redirect, oráculo de padding con la clave AES fija, secreto JWT por defecto, contraseñas en el log, credenciales del SIEM y de diag, flags públicas, diagnósticos en la exportación, enumeración de cuentas y falta de rate limiting.
- Todos los hallazgos dan fichero, línea y CWE, con el código que lo demuestra y una corrección concreta. Ninguno es inventado.
- Los siete hallazgos sin entrada son fallos reales que RealVuln no etiqueta (reset predecible, CVE de Next, CSRF por GET, cabecera Host, Docker como root, cabeceras HTTP, Prisma Studio), y dentro de los aciertos señala otros más: middleware sin firma, /internal por cabecera, revocación ignorada, LCG de tarjetas regalo, clave RTMP, cabecera MCP fija y XSS de SupportForm.

## Lo que falta o está mal

- No cubre: la fuga de la URL de origen de las herramientas del asistente (011), el logout que no invalida la sesión (015) y las credenciales del seed (042, crítica).
- Agrupa varios fallos por hallazgo y cita rangos anchos (8-64, 13-42, 112-137…): ocho entradas valen medio acierto por pasar de 20 líneas.
- La SSRF de mcpServerUrl, la inyección indirecta por respuestas del MCP, el MD5 del reset (lo sitúa en server-auth), la subida de SVG (cita la lista de tipos), los hashes de /news y el token de soporte guardado en claro los ve, pero con líneas fuera de tolerancia o en otro fichero: valen para el juez, no para la nota.
- El CSRF general está exagerado: las cookies van con sameSite lax; solo el login por GET de support-login se sostiene.

## Rarezas de la sesión

- Dice que el pie de página describe el proyecto como plataforma educativa de seguridad; no nombra el proyecto original.
- No sale a internet (webfetch y websearch denegados; no lo intenta): cita CVE-2025-55182 a partir del nombre de una flag de .env.local y CVE-2025-29927 de memoria.
- Solo dos órdenes de shell (cat de dos ficheros que ya podía leer con read) y 134 lecturas; un glob falla por buscar una carpeta components que no existe.
- No toca el código: solo crea AUDITORIA_SEGURIDAD.md.
- Agrupa mucho: 22 hallazgos que reúnen varios fallos cada uno, con rangos de línea anchos que en 8 entradas dejan el acierto a medio punto.
