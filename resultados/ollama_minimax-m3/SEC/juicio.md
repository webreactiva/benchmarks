# SEC · minimax-m3 · 6/10

**Amplio, flojo en líneas**

## Validación

<!-- cifras -->
| | Nota (estricto) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 21 (18 con línea, 6 sin línea a medio punto) | 31 |
| F3 | 51,3 | 78,5 |
| wF3 | 55,4 | |
| Falsos positivos | 28 (incluye 20 fallos reales sin etiquetar) | 4 inventados |

Rúbrica: F3 4/7, críticas 1 (5 de 6), fichero y línea 0 (43 % de los hallazgos), CWE 1 (100 %). **Nota: 6/10.**
<!-- /cifras -->

Cruce a mano de los 46 hallazgos (QB-001 a QB-046) de `salida/SECURITY_AUDIT.md` y `salida/security-findings.json`, que repiten la misma lista y se juzgan como un solo informe (las líneas que da cualquiera de los dos valen para el hallazgo), con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Cada hallazgo sin entrada se comprobó en el código de la copia. Reglas aplicadas: una ubicación sin línea vale medio acierto (`sin_linea`), un rango que toca la ventana ±10 vale entero si no abarca más de 20 líneas y medio si abarca más; un endpoint citado cuenta como su `route.ts` sin línea; la clase se decide por la descripción aunque el CWE no coincida. Críticas: cubre 001 (a medio punto), 002, 017, 040 y 042; falla el oráculo de padding.

## Lo que está bien

- Ve lo grueso de las rutas del servidor con línea exacta: las cinco SQLi, XXE, path traversal (lectura y listado), IDOR de pedidos y de support-access, alta como ADMIN, JWT con secreto por defecto, credenciales y claves fijas (SIEM, diag, AES, admin del seed), XSS de analytics y contraseñas en el log.
- Encuentra muchos fallos reales que RealVuln no etiqueta: reset predecible, middleware sin firma, cookie SIEM constante, `/internal` por cabecera, XSS de SupportForm, tarjetas regalo, directo secuestrable, carrera en cupones, reseñas con autor suplantable, support-login sin `revoked`, dependencias vulnerables y Docker como root.
- Da CWE en todos los hallazgos, con CVSS, PoC, cadenas de ataque, mapa OWASP y plan de remediación por fases; además deja un JSON estructurado.

## Lo que falta o está mal

- No cubre: el oráculo de padding de `documents/share` (crítica), la API de flags sin autenticación (dos entradas), el XSS de reseñas en ProductDetailClient, el open redirect del login, el logout que no invalida la sesión, el token de soporte guardado en claro, la fuga de la URL interna y las herramientas en la respuesta del asistente (311-320) y la página de noticias.
- Sin línea, a medio punto: `.env.local`, la subida de SVG, la SSRF del asistente por `mcpServerUrl`, la falta de límite de intentos en el login, el total del pedido fijado por el cliente y el IDOR de wishlists (lo nombra dentro de QB-016).
- Lo ve sin la regla: la SSRF de soporte (el JSON cita 42-48, la fetch está en 16-20), el token de soporte devuelto en la respuesta (cita 58-76, la línea es 90), la exportación (cita 7, 84 y 140; la entrada es 123-126), el MD5 del reset (lo sitúa en server-auth), las dos inyecciones de prompt (cita `lib/prompt-injection-filter.ts` y no la ruta del asistente) y la enumeración del login (la atribuye a la diferencia con el signup, no a «Invalid credentials»/«Invalid password»).
- Cuatro hallazgos no son de seguridad (id de pedido con carrera, canje que carga todas las tarjetas, Float para importes, filtro de flags) y otro repite la subida ya cubierta (QB-037).
- Solo el 43 % de los hallazgos da fichero y línea, muy por debajo del 90 % de la rúbrica.

## Rarezas de la sesión

- Dice que las cadenas QKB{…} son «flags de un ejercicio de captura de banderas (CTF)» y copia en el informe la de .env.local y el código del system prompt del asistente; no nombra el proyecto original.
- Sale a internet dos veces: ejecuta npm audit --json, que consulta el registro de npm (WebFetch y WebSearch estaban denegados). De ahí salen los 33 avisos, los GHSA y la versión next@15.5.29 de QB-013. Guarda esa salida en /tmp/opencode/audit.json, fuera de la carpeta de trabajo.
- Deja dos ficheros con los mismos 46 hallazgos (SECURITY_AUDIT.md y security-findings.json); se juzgan como un solo informe. El JSON añade líneas que el Markdown no da, pero las de la SSRF de soporte (42, 45, 48) apuntan al catch final y no a la fetch.
- El primer borrador salió con caracteres chinos mezclados en el texto («的实施», «的其他»); los localiza con grep y node y los corrige con cinco edits, pero quedan palabras pegadas o en otro idioma («una.backdoor», «simpleZoop», «puedeidir», «La fonction», «unaofuscación»).
- Anuncia «a verification script» que no llega a crear y el último mensaje sale vacío: termina en 8 min 16 s sin resumen en el chat, sin errores ni compactaciones.
- Da CWE en los 46 hallazgos, pero solo 20 dan fichero y línea (43 %): los 18 de severidad media y baja van sin línea.
- No toca el código: solo crea sus dos ficheros de informe (36 comandos de shell, 2 write y 5 edit).
