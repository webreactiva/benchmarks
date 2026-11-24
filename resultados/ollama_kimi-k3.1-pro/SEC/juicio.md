# SEC · kimi-k3.1-pro · 8/10

**Amplio, preciso, rangos anchos**

## Validación

<!-- cifras -->
| | Nota (estricto) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 25,5 (17 con línea, 17 sin línea a medio punto) | 35 |
| F3 | 64,3 | 88,6 |
| wF3 | 65 | |
| Falsos positivos | 11 (incluye 10 fallos reales sin etiquetar) | 0 inventados |

Rúbrica: F3 5/7, críticas 1 (5 de 6), fichero y línea 1 (100 % de los hallazgos), CWE 1 (97 %). **Nota: 8/10.**
<!-- /cifras -->

Cruce a mano de los 34 hallazgos de `salida/AUDITORIA_SEGURIDAD.md` (C-01 a C-10, H-01 a H-13, M-01 y M-03 a M-11, L-01; falta M-02, borrado antes del corte) con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Los JSON de `npm audit` y `npm pack` no se cuentan como hallazgos; solo C-09 los usa. Cada hallazgo sin entrada se comprobó en el código de la copia. Reglas aplicadas: una ubicación sin línea vale medio acierto (`sin_linea`), un rango vale si toca la ventana ±10 y no abarca más de 20 líneas (si abarca más, cuenta como sin línea), el endpoint citado cuenta como su `route.ts` sin línea y la clase se decide por la descripción aunque el CWE no coincida.

## Lo que está bien

- Cubre 35 de las 40 entradas a juicio del juez: las cinco SQLi (con la de segundo orden desde reseñas), XXE, SSRF de soporte, traversal, IDOR de pedidos, wishlists y soporte, alta como ADMIN, claves JWT y AES de respaldo, credenciales de SIEM, diag y seed, contraseñas en el log, MD5 en el reset, logout, XSS de analytics y de reseñas, SVG, open redirect, flags sin autenticación, noticias, exportación y total del pedido.
- Ningún hallazgo inventado: los diez que no tienen entrada son fallos reales (token de reset predecible, directo secuestrable, tarjetas regalo, middleware sin firma y `/internal` por cabecera, XSS de SupportForm, carrera en cupones, Next.js vulnerable, API key en localStorage, Docker como root, cabeceras).
- Da fichero y línea en todos los hallazgos y CWE en 33 de 34; gana los dos puntos de forma y el de críticas (5 de 6).
- Separa lo verificado en el código de lo que depende del LLM, del proxy o de la configuración, y no copia los valores de los secretos.

## Lo que falta o está mal

- No cubre: la SSRF de `mcpServerUrl` (008; la tenía como M-02 y la borró en la última edición antes del corte), la fuga de las herramientas y sus URL en la respuesta del asistente (011), la enumeración por mensajes distintos en el login (014), el oráculo de padding de `documents/share` (018, crítica; habla de CBC sin MAC) y el token de soporte guardado en claro (034).
- Rangos de más de 20 líneas en trece ubicaciones: support-access (51-91, dos entradas), búsqueda de pedidos (81-103), reseñas de admin (102-143, dos entradas), `/api/files` (8-67, dos entradas), pedidos (8-64), soporte (6-37), `share-crypto.ts` (6-31), noticias (95-135), asistente (253-319), subida de imágenes (47-85), wishlists (6-81), diag (5-25, una línea de más) y LoginForm (15-43). Tocan la ventana, así que cuentan como sin línea: medio acierto cada una. `.env.local` lo nombra sin línea: medio acierto.
- El rate limiting del login (M-05) lo menciona sin citar `login/route.ts`: no estricto.
- El resumen anuncia 36 grupos y hay 34.

## Rarezas de la sesión

- Cortado por el límite de uso de Ollama Cloud (429, provider.quota) a los 11 min 17 s, en una segunda pasada con el informe ya escrito. Se juzga tal cual.
- Su última edición antes del corte borró M-02 (SSRF por mcpServerUrl en ai-assistant:63-99, que habría cubierto la entrada 008 como medio acierto) para subirla de severidad, y no llegó a reinsertarla: el informe se queda sin la SSRF del asistente y el resumen sigue anunciando 36 grupos (12 medios) cuando hay 34 (10 medios).
- Ejecuta dos veces npm audit --package-lock-only, que consulta el registro de npm: es la única salida a la red; sin curl, git ni webfetch. Los GHSA de Next.js salen de ese audit, no de memoria. npm pack --dry-run es local. Deja los JSON de ambos en salida/; no son hallazgos por sí mismos y se juzgan solo a través de C-09.
- Lo llama «laboratorio vulnerable» por las flags; no nombra el proyecto original ni copia los valores de flags, claves o contraseñas al informe.
- Reparte la revisión en tres subagentes (autenticación, inyección, configuración) y 136 lecturas; cinco edit sobre su propio informe. No toca el código del proyecto.
- Da fichero y línea en los 34 hallazgos y CWE en 33 (C-09 pone «múltiples»), pero trece ubicaciones son rangos de más de 20 líneas (51-91, 81-103, 102-143, 8-67, 8-64, 6-37, 6-31, 95-135, 253-319, 47-85, 6-81, 5-25, 15-43): las 16 entradas que cubren valen medio acierto, y .env.local sin línea, otra más.
