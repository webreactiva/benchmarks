# SEC · mistral-large-4 · 5/10

**Cruce sólido, forma descuidada**

## Validación

<!-- cifras -->
| | Nota (estricto) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 22 (18 con línea, 8 sin línea a medio punto) | 32 |
| F3 | 54,5 | 80 |
| wF3 | 57,5 | |
| Falsos positivos | 22 (incluye 10 fallos reales sin etiquetar) | 8 inventados |

Rúbrica: F3 4/7, críticas 1 (5 de 6), fichero y línea 0 (62 % de los hallazgos), CWE 0 (85 %). **Nota: 5/10.**
<!-- /cifras -->

Cruce a mano de los 39 hallazgos de `salida/security-audit-report.md` (C-1 a C-17, A-1 a A-9, M-1 a M-7 y B-1 a B-6; la matriz de endpoints y la tabla de secretos repiten los mismos fallos) con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Cada hallazgo sin entrada se comprobó en el código de la copia. Reglas aplicadas: una ubicación sin línea vale medio acierto (`sin_linea`), un rango vale si toca la ventana ±10 y no abarca más de 20 líneas (si abarca más, cuenta como sin línea), el endpoint citado cuenta como su `route.ts` sin línea, y la clase se decide por la descripción aunque el CWE no coincida.

## Lo que está bien

- Reconoce las cinco SQLi (cuatro con línea dentro de la ventana), XXE, SSRF de soporte, path traversal, IDOR de pedidos y de wishlists, alta como ADMIN, secreto JWT, clave AES, credenciales del SIEM, token de diag, contraseñas en el log, XSS de analytics y de reseñas, flags sin autenticación, diagnósticos en la exportación y el token de soporte para otro email.
- Cubre cinco de las seis entradas críticas (dos de ellas, `.env.local` y `seed.ts`, sin línea).
- Diez fallos reales que RealVuln no etiqueta: CVE de Next, middleware sin firma y `/internal` por cabecera, tarjetas regalo y reset predecibles, carrera en cupones, IDs de pedido secuenciales, falta de cabeceras, clave de Mistral en localStorage, Docker que copia los secretos, comparación de firma con `!==` y el directo secuestrable.

## Lo que falta o está mal

- No cubre: el oráculo de padding de `documents/share` (crítica; lo menciona y lo descarta diciendo que el endpoint devuelve un 400 genérico, cuando distingue el fallo de descifrado de los errores posteriores), el open redirect de `LoginForm`, el logout que no invalida la sesión, el token de soporte guardado en claro y devuelto en la respuesta, el total del pedido que manda el cliente, la fuga de la URL y las herramientas del asistente y la página de noticias.
- Medio acierto por ir sin línea: `/api/flags` y `/api/flags/[slug]`, `.env.local`, `seed.ts` y la enumeración del login (cubierta porque la matriz la liga a `POST /api/auth/login`). Rangos de más de 20 líneas: `/api/files` (19-67, dos entradas) y búsqueda de pedidos (81-102).
- Fuera de la ventana: la SSRF y las dos prompt injection del asistente (200-212 y línea 22 frente a 69-81, 221 y 291), el SVG (línea 14 frente a 64-72), el MD5 en `server-auth.ts` y no en el reset, y el rate limiting del login sin citar el fichero.
- Ocho hallazgos no se sostienen como fallo propio: límites de body (M-3), el filtro de `qkb{` (M-5), dependencias a auditar (M-6), logs con PII que repiten C-13 y C-15 (M-7), cobertura del middleware (B-1), productos sin paginación (B-2), cookie `secure` solo en producción (B-4) y versiones de eslint (B-6).
- Pierde los dos puntos de forma: el 62 % de los hallazgos da fichero y línea y el 85 % da CWE (la sección B no da ninguno).

## Rarezas de la sesión

- No nombra el proyecto original (OopsSec, RealVuln); lo llama Quokka Bazaar y trata las flags QKB{…} como secretos a rotar.
- No sale a internet ni ejecuta comandos: 80 read, 6 grep, 1 glob y 1 write, sin shell. El CVE-2025-55182 de Next lo cita de memoria, sugerido por la variable FLAG_CVE_2025_55182 de .env.local.
- Copia en la sección de secretos los valores QKB{…} de .env.local, flag.txt, notice.txt, supplier-registry.txt y del system prompt del asistente.
- Se le cuelan palabras en otros idiomas en el informe: «限制 entity expansion», «代替 de la cabecera» y «Any token con 3 partes».
- Los seis hallazgos de la sección B no dan CWE y quince hallazgos van sin línea (C-7, C-16, A-4, A-9, M-2 a M-7, B-1, B-2, B-4 a B-6): pierde los dos puntos de forma.
- Deja un solo fichero (security-audit-report.md) y no toca el código. Sin errores, subagentes ni compactaciones; termina en 3 min 40 s.
