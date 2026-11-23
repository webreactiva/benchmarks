# SEC · glm-5.3-flash · 5/10

**Ve casi todo, localiza peor**

## Validación

Cruce a mano de los 39 hallazgos de `salida/informe-auditoria-seguridad-quokka-bazaar.md` (F-01 a F-38 y la nota de sesiones no revocables) con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Cada hallazgo sin entrada se comprobó en el código de la copia.

| | Estricto (nota) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 23 | 35 |
| F3 | 57,5 | 88,4 |
| wF3 | 58,5 | |
| Falsos positivos | 17 (incluye 9 fallos reales sin etiquetar y 7 aciertos mal localizados) | 1 |

Rúbrica: F3 4/7, críticas 1 (4 de 6; falla el oráculo de padding y el XSS de analytics solo aparece en una cadena de ataque), fichero y línea 0 (77 %), CWE 0 (51 %: los da en críticos y altos, no en medios y bajos).

## Lo que está bien

- Reconoce casi todo lo que se ve leyendo las rutas: las cinco SQLi, XXE, SSRF de soporte, path traversal, IDOR de pedidos y de wishlists, alta como ADMIN, credenciales y claves fijas, XSS de reseñas, open redirect, enumeración de cuentas, contraseñas en el log y el token de soporte en la URL.
- Solo un hallazgo no se sostiene (F-28, el canje de tarjetas que el propio informe da por correcto) y uno lleva una parte inventada (el traversal por `id` en la subida de imágenes).
- Encuentra fallos reales que RealVuln no etiqueta: reset predecible, middleware sin firma, tarjetas regalo, carrera en cupones, página interna por cabecera, XSS de SupportForm, Docker con `.env.local` dentro.
- Informe ordenado, con PoC, cadenas de ataque y plan de remediación.

## Lo que falta o está mal

- No cubre: el oráculo de padding de `documents/share` (crítica), la fuga de la URL interna y las herramientas del asistente, la inyección por salida de herramientas (línea 291), el token de soporte guardado en claro y la página de noticias.
- Cita rangos anchos que empiezan fuera de ±10: SQLi de productos (85-96), de pedidos (81-98) y de reseñas de admin (103-134), la lectura de `/api/files` (un solo rango 19-67) y el total del pedido (35-218). Valen para el juez, no para la nota.
- El XSS de analytics, el MD5 del reset, el rate limiting, el logout y los diagnósticos de export los ve sin fichero o con la línea equivocada.
- Ningún CWE en los 19 hallazgos medios y bajos.

## Rarezas de la sesión

- Dice que es «una app tipo CTF» con vulnerabilidades plantadas por las flags QKB{…}; no nombra el proyecto original.
- No sale a internet: solo usa read, glob, grep y tres comandos de shell locales (grep en package-lock, cat de .dockerignore, un script de Python sobre package-lock). El CVE de Next lo cita de memoria; los curl solo aparecen en las PoC del informe.
- Lee 101 ficheros uno a uno sin subagentes y termina en 2 min 17 s, sin errores ni compactaciones.
- Da CWE en los 20 hallazgos críticos y altos y en ninguno de los medios y bajos; los rangos de línea anchos (81-98, 103-134, 35-218) le cuestan cinco entradas estrictas.
- No toca el código: solo crea informe-auditoria-seguridad-quokka-bazaar.md.
