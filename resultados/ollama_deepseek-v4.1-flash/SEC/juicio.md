# SEC · deepseek-v4.1-flash · 6/10

**Ve mucho, rangos demasiado anchos**

## Validación

<!-- cifras -->
| | Nota (estricto) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 17,5 (17 con línea, 1 sin línea a medio punto) | 34 |
| F3 | 43,8 | 85,9 |
| wF3 | 45,8 | |
| Falsos positivos | 22 (incluye 11 fallos reales sin etiquetar) | 2 inventados |

Rúbrica: F3 3/7, críticas 1 (5 de 6), fichero y línea 1 (97 % de los hallazgos), CWE 1 (100 %). **Nota: 6/10.**
<!-- /cifras -->

Cruce a mano de los 38 hallazgos de `salida/SECURITY_AUDIT.md` (F-01 a F-38; `hallazgos.json` repite las mismas ubicaciones y `flags_encontrados.csv` no añade fallos) con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Cada hallazgo sin entrada se comprobó en el código de la copia. Reglas aplicadas: una ubicación sin línea vale medio acierto (`sin_linea`), un rango vale si toca la ventana ±10 y no abarca más de 20 líneas, y la clase se decide por la descripción aunque el CWE no coincida.

## Lo que está bien

- Reconoce casi todo lo que se ve leyendo las rutas: las cinco SQLi, XXE, SSRF de soporte, path traversal, IDOR de pedidos y de wishlists, alta como ADMIN, claves y credenciales fijas, XSS de analytics y de reseñas, open redirect, contraseñas en el log, MD5, SVG subido y diagnósticos en la exportación.
- Da CWE en todos los hallazgos y fichero con línea en todos menos uno; los dos puntos de rúbrica de forma los gana.
- Solo dos hallazgos no se sostienen: la validación genérica de esquemas (F-36) y la inyección de líneas en el logger (F-38), que escribe cada entrada con `JSON.stringify`.
- Encuentra once fallos reales que RealVuln no etiqueta: middleware sin firma, reset predecible, tarjetas regalo, carrera en cupones, directo secuestrable, cabecera MCP fija, `/internal` por cabecera, XSS de SupportForm, dependencias, Docker como root y host header en los enlaces de compartir.

## Lo que falta o está mal

- No cubre: el oráculo de padding de `documents/share` (crítica; habla de CBC sin MAC), la fuga de la URL interna y las herramientas del asistente, el logout que no invalida la sesión, el token de soporte guardado en claro y devuelto en la respuesta, y la página de noticias.
- Rangos de más de 20 líneas: `/api/files` (18-52, dos entradas), búsqueda de pedidos (81-102), reseñas de admin (102-141, dos entradas), support-access (52-92), pedidos (8-60), wishlists (7-55), exportación (120-142) y subida de imágenes (60-90). Valen para el juez, no para la nota.
- La SSRF y las dos prompt injection del asistente las cita lejos de sus líneas (145-175 y 9-31 frente a 69-81, 221 y 291); el MD5 lo sitúa en `server-auth.ts` y no en el reset; el rate limiting y la enumeración del login, sin citar el fichero.
- `seed.ts` sin línea: vale medio acierto.

## Rarezas de la sesión

- Dice que el proyecto es «un entorno de laboratorio/CTF» por las flags QKB{…}; no nombra el proyecto original.
- No sale a internet: 43 comandos de shell locales (cat, grep, sed, find y cuatro scripts de Python), sin curl, git ni npm audit; los curl solo aparecen en las PoC. Los CVE de Next y React los cita de memoria (el de React lo sugiere la variable FLAG_CVE_2025_55182 de .env.local).
- Saca con un script de Python las 35 flags de prisma/seed.ts y las publica en flags_encontrados.csv; con otro reproduce el generador de tarjetas regalo y da el código de la tarjeta sembrada de 500 USD.
- Deja cuatro ficheros (SECURITY_AUDIT.md, hallazgos.json, flags_encontrados.csv, README_AUDITORIA.md), juzgados como un solo informe; los dos edit corrigen el recuento de su propio informe (37 → 38).
- Da CWE en los 38 hallazgos y línea en 37, pero nueve ubicaciones son rangos de más de 20 líneas (18-52, 81-102, 102-141, 52-92, 8-60, 7-55, 120-142, 60-90, 1-31) que le cuestan diez entradas estrictas.
- Sin subagentes, errores ni compactaciones; termina en 5 min 33 s. No toca el código del proyecto.
