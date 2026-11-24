# SEC · inkling-2-small (Ollama) · 4/10

**Ve mucho, localiza poco**

## Validación

<!-- cifras -->
| | Nota (estricto) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 16,5 (2 con línea, 29 sin línea a medio punto) | 32 |
| F3 | 41,4 | 80,4 |
| wF3 | 41,9 | |
| Falsos positivos | 22 (incluye 15 fallos reales sin etiquetar) | 6 inventados |

Rúbrica: F3 3/7, críticas 1 (4 de 6), fichero y línea 0 (7 % de los hallazgos), CWE 0 (0 %). **Nota: 4/10.**
<!-- /cifras -->

Cruce a mano de los 46 hallazgos de `salida/SECURITY_AUDIT.md` (44 numerados y dos que solo están en las cadenas de ataque: XXE y open redirect) con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Cada hallazgo sin entrada se comprobó en el código de la copia. Las ubicaciones sin línea van con `sin_linea` y valen medio acierto.

## Lo que está bien

- A juicio cubre casi todo lo que se ve leyendo las rutas: alta como ADMIN, secreto JWT, tres SQLi, path traversal en sus dos vectores, support-access con email ajeno, IDOR de pedidos y wishlists, las dos SSRF, XSS de analytics y reseñas, SVG subido, flags públicas, prompt injection directa e indirecta, contraseñas en el log y credenciales fijas.
- Solo dos aciertos dan línea y cuentan enteros: `lib/server-auth.ts:12` (secreto JWT) y `ProductDetailClient.tsx` ≈50-60 (XSS de reseñas).
- Encuentra fallos reales que RealVuln no etiqueta (middleware sin firma, reset predecible, /internal por cabecera, cupones, tarjetas regalo, CSV injection, sesiones de soporte de un año).

## Lo que falta o está mal

- Casi nunca da línea: 3 de 46 hallazgos la traen, y la del alta como ADMIN (≈52-83) abarca 32 líneas, así que cuenta como sin línea. Los 29 aciertos sin línea valen medio punto cada uno; el open redirect, sin fichero, solo vale para el juez.
- No cubre ni a juicio: el oráculo de padding de `documents/share` (crítica), las credenciales del seed (crítica), la fuga de la URL y las herramientas del asistente, el logout, el token de soporte en claro y la página de noticias.
- Dice que hay SQLi en `admin/reviews`, pero solo en el resumen y en las prioridades, sin hallazgo; no se cuenta.
- Ningún CWE. Seis hallazgos no son fallos: dos son controles que están bien y el resto no se sostiene o es higiene.

## Rarezas de la sesión

- Ejecuta npm audit y lo consigue: sale al registro de npm pese a correr sin web (webfetch y websearch estaban denegados, el shell no).
- Vuelca todas las rutas API a /tmp/opencode/api-routes.txt, fuera de la carpeta de trabajo, para leerlas por trozos.
- No nombra el proyecto original; ve las flags QKB{…} y avisa de que no reproduce sus valores.
- La tabla del resumen dice 8 medios y 6 bajos; el informe trae 10 y 15. Dos de los bajos son controles que están bien (B-12, B-15).
- XXE y open redirect solo aparecen en las cadenas de ataque, sin hallazgo propio; la SQLi de admin/reviews solo en el resumen y en las prioridades.
- Casi no da líneas (3 de 46 hallazgos) ni ningún CWE.
- No toca el código: solo crea SECURITY_AUDIT.md. 16 peticiones, 2 min 9 s.
