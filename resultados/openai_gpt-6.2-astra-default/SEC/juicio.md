# SEC · gpt-6.2-astra · 3/10

**Preciso pero corto**

## Validación

<!-- cifras -->
| | Nota (estricto) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 13 (todas con línea) | 15 |
| F3 | 34,4 | 40,0 |
| wF3 | 37,4 | |
| Falsos positivos | 5 (incluye 5 fallos reales sin etiquetar) | 0 inventados |

Rúbrica: F3 2/7, críticas 0 (3 de 6), fichero y línea 1 (100 % de los hallazgos), CWE 0 (ninguno). **Nota: 3/10.**
<!-- /cifras -->

Cruce a mano de los 14 hallazgos de `salida/AUDITORIA_SEGURIDAD.md` con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Cada hallazgo sin entrada se comprobó en el código de la copia.

## Lo que está bien

- Cada hallazgo cita la línea exacta: los 13 aciertos valen punto entero, sin rangos anchos.
- Lo que encuentra es grave y está bien explicado: alta como administrador, clave JWT fija, path traversal en lectura y listado, SQLi de productos y seguimiento, SSRF de soporte y del MCP del asistente, XSS de analítica, total del pedido del cliente, XXE, clave AES fija y credenciales del SIEM.
- Ninguno es inventado. Los cinco sin entrada son reales: reset predecible, Next.js 15.2.2, MD5 (lo sitúa en el alta), carrera de cupones y `.env.local` dentro de la imagen.
- Cada corrección trae un criterio de aceptación comprobable.

## Lo que falta o está mal

- Se queda corto: 14 hallazgos para 40 entradas. No ve las dos SQLi de reseñas (005, 006), los IDOR de pedidos, listas y soporte (025, 036, 033-035), el open redirect (037), las flags públicas (021, 023), la credencial del diag (003), las contraseñas en el log (012), la subida de SVG (004), el login sin límite (013, 014), el logout (015), la clave de `.env.local` (001), las credenciales del seed (042), la inyección de prompt (009, 010) ni la XSS de la ficha de producto (039).
- La SQLi de pedidos (027) la cita en la línea 81, fuera de la ventana; el MD5 del reset (016), en otro fichero; el oráculo de padding (018) se queda en «CBC sin autenticación».
- Ningún hallazgo da CWE.

## Rarezas de la sesión

- Auditoría rápida: 9 órdenes de shell, 10 peticiones y 221 k tokens, sin razonamiento apuntado (esfuerzo por defecto). Busca patrones (queryRawUnsafe, dangerouslySetInnerHTML…) y lee unas pocas rutas; nunca abre admin/reviews, orders/[id], wishlists, support-access, flags ni LoginForm.
- Oculta valores al leer: tapa con sed los secretos de docker-compose y las cadenas de monitoring/auth. No nombra el proyecto original.
- No sale a internet: cita CVE-2025-55182 y CVE-2025-66478 de memoria, con el enlace al aviso de Next.js.
- No toca el código: solo crea AUDITORIA_SEGURIDAD.md (36 líneas, 14 hallazgos en una tabla).
