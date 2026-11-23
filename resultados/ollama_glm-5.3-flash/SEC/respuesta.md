Es un proyecto Next.js con e-commerce, panel admin, Prisma, gift cards, etc. Voy a explorar la estructura completa, empezando por las rutas API y los archivos de configuración clave.

---

Primeras observaciones: middleware que decodifica JWT sin verificar firma, `libxmljs2` (posible XXE), `flag.txt` y `.env.local` en el repo. Voy a leer los archivos de configuración y secretos.

---

Es una app tipo CTF ("Quokka Bazaar") con vulnerabilidades intencionales, ideal para auditoría. He detectado ya: MD5 para contraseñas, admin con credenciales débiles, secretos en el repo. Ahora leo las librerías core.

---

Nuevos hallazgos: `JWT_SECRET` por defecto `"secret"`, clave de cifrado de shares hardcodeada, stream key en el código, y códigos de gift card predecibles (LCG con semilla de timestamp). Ahora reviso las rutas API — empiezo por auth y admin.

---

Hallazgos críticos acumulándose: logging de contraseñas en texto plano, escalada de rol en signup, tokens de reset predecibles (MD5 de email+timestamp con `requestedAt` devuelto), XXE confirmado (`noent: true, dtdload: true`), y creación de tokens de soporte para cualquier usuario. Sigo con las rutas restantes.

---

SQL injection en `admin/reviews` (interpolación directa), credenciales SIEM `root/admin` hardcodeadas con cookie sesionable y forjable, path traversal anónimo en `/api/files` (sin auth y sin sanitizar `../`), y subida de SVG (XSS almacenado). Sigo con el resto de rutas.

---

Confirmado: `total` del pedido viene del cliente (falsificación de precio), SQLi en `/api/orders/search` vía `status`, IDOR en `/api/orders/[id]` (cualquier usuario ve pedidos ajenos con PII), y códigos de gift card derivados del timestamp de creación. Leo las rutas restantes.

---

Más hallazgos: SQLi no autenticado en `/api/tracking` vía header `X-Forwarded-For`, SSRF en `/api/support` (fetch a URL arbitraria con header interno), los flags de la BD expuestos públicamente en `/api/flags`, y `X-MCP-Session` constante falsificable. Reviso las rutas restantes y el frontend para XSS.

---

Ahora reviso los schemas de validación y busco posibles XSS en el frontend (`dangerouslySetInnerHTML`, markdown, etc.).

---

Hay candidatos serios de XSS: `innerHTML` con contenido de reviews, `visit.ip` inyectado como HTML, y un `div` oculto en admin/documents. Los reviso junto con las páginas sensibles.

---

Confirma XSS almacenado grave: el cliente de productos reasigna `innerHTML` con el contenido de la review y **re-crea los `<script>` para ejecutarlos** (reviews sin autenticación). También: XSS vía `visit.ip` (chained con la SQLi de tracking), SSRF+XSS en support. Sigo con archivos misceláneos y posibles paquetes maliciosos.

---

Chequeo dependencias con CVEs conocidos en `package-lock.json`, y las páginas de cliente restantes (login, gift cards, SIEM, documentos, live).

---

La página SIEM confirma el flujo con cookie forjable. Reviso los últimos archivos cliente y hooks para cerrar el mapeo.

---

Tengo el mapa completo. Ahora genero el informe de auditoría consolidado y lo guardo en la carpeta actual.

---

Auditoría completada y guardada en **`informe-auditoria-seguridad-quokka-bazaar.md`** en la carpeta actual.

## Resumen del proyecto

Es **Quokka Bazaar v2.17.0** (Next.js 15 + Prisma/SQLite), una app e-commerce tipo CTF con vulnerabilidades plantadas. Auditado por revisión estática de código completo.

## Resultado: 9 críticos, 10 altos, 7 medios, 8 bajos

**Los hallazgos más graves:**

| # | Hallazgo | Ubicación |
|---|---|---|
| 🔴 | Escalada a ADMIN en el registro (`role` aceptado del cliente) | `app/api/auth/signup` |
| 🔴 | Todos los secretos expuestos sin auth (`GET /api/flags`) | `app/api/flags` |
| 🔴 | Path traversal anónimo: `GET /api/files?file=../.env.local` | `app/api/files` |
| 🔴 | SQLi no autenticada vía header `X-Forwarded-For` | `app/api/tracking` |
| 🔴 | SQLi no autenticada en búsqueda de productos | `app/api/products/search` |
| 🔴 | Reset de contraseña predecible: token = `md5(email+timestamp)` y la API **devuelve** el timestamp → account takeover | `app/api/auth/forgot-password` |
| 🔴 | JWT con secreto por defecto `"secret"` (no configurado) → forja de sesiones admin | `lib/server-auth.ts` |
| 🔴 | SQLi adicional en `orders/search` y `admin/reviews` | ambos rutas |
| 🔴 | XSS almacenado con ejecución de `<script>` en reviews (inyectable sin auth) | `ProductDetailClient.tsx` |

**Otros destacados:** contraseñas en MD5 sin salt, contraseñas logueadas en texto plano (y el SIEM se accede con cookie forjable o `root:admin`), XXE en importación de proveedores (lee `supplier-registry.txt`), SSRF en `/api/support`, total de pedido enviado desde el cliente (fraude de precio), race condition en cupones, códigos de gift card predecibles (LCG por timestamp — la tarjeta de $500 sembrada es bruteable), secretos hardcodeados en código y `.env.local` versionado con `NEXT_PUBLIC_` en un secreto, y Next.js 15.2.2 vulnerable a CVE-2025-29927.

El informe incluye ubicaciones exactas (archivo:línea), PoCs, impacto, mitigación por hallazgo, cadenas de ataque completas, un plan de remediación priorizado (P0/P1/P2) y un apéndice con los secretos a rotar.
