# SEC · gpt-6.2-astra · 5/10

**Amplio y preciso, líneas de entrada**

## Validación

<!-- cifras -->
| | Nota (estricto) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 16 (todas con línea) | 23 |
| F3 | 41,9 | 60,1 |
| wF3 | 41,8 | |
| Falsos positivos | 6 (incluye 6 fallos reales sin etiquetar) | 0 inventados |

Rúbrica: F3 3/7, críticas 1 (4 de 6), fichero y línea 1 (100 % de los hallazgos), CWE 0 (ninguno). **Nota: 5/10.**
<!-- /cifras -->

Cruce a mano de los 20 hallazgos de `salida/AUDITORIA_SEGURIDAD.md` con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Cada hallazgo sin entrada se comprobó en el código de la copia.

## Lo que está bien

- Ve casi todo lo grave: alta como administrador, token de soporte para cualquier correo, contraseñas en el log, clave JWT fija y administrador del seed, SQLi de seguimiento, path traversal, IDOR de pedidos y listas, SSRF de soporte, XSS de analítica, total del pedido del cliente, clave AES fija, XXE, SVG y open redirect.
- Ninguno es inventado. Los seis sin entrada son reales: reset predecible, Next.js 15.2.2, tarjetas regalo deterministas, MD5 y hash en la exportación, middleware sin firma y secreto de pago en el cliente con `.env.local` en la imagen.
- Criterios de cierre comprobables para cada bloque y el resultado de npm audit como anexo.

## Lo que falta o está mal

- Cita la línea de entrada de la función, no la del fallo: las SQLi de productos (85), pedidos (81) y reseñas (103) quedan fuera de la ventana de sus consultas (100, 102 y 120-136); la lectura de archivos (17) no llega a la 62; la SSRF del asistente (199) no llega a 69-81. Valen para el juez, no para la nota.
- No cubre: la clave de `.env.local` (001), la credencial del diag (003), la inyección de prompt (009, 010) y la fuga del asistente (011), el login sin límite y con mensajes distintos (013, 014), el logout (015), las flags públicas (021, 023), las credenciales del SIEM (024; cita el visor de logs), el token de soporte en la respuesta y guardado en claro (034, 035), los hashes en /news (038) y la XSS de la ficha de producto (039).
- Ningún hallazgo da CWE.

## Rarezas de la sesión

- Busca con rg las palabras «vulnerab» e «intentionally» para saber si el proyecto se declara vulnerable a propósito. No nombra el proyecto original.
- Sale a internet sin búsqueda web: npm audit contra el registro de npm, que deja en auditoria-dependencias.json. La herramienta de búsqueda estaba desactivada; la red, no.
- Cita siempre una sola línea, la de entrada de la función: en las SQLi de productos, pedidos y reseñas cae a 5-20 líneas de la consulta y queda fuera de la ventana.
- No toca el código. 14 peticiones y 470 k tokens, con 13 órdenes de shell.
