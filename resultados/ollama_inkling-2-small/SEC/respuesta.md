Voy a revisar un par de detalles más antes de redactar el informe.

---

Tengo una imagen completa. Ahora redacto el informe de auditoría en la carpeta actual.

---

He completado la auditoría y guardado el informe completo en **`/var/tmp/bench/ws-GZ05kvDV/SECURITY_AUDIT.md`**.

**Resumen de lo encontrado** (revisión estática de las ~57 rutas API, páginas, `lib/`, config, Docker y `npm audit`):

**Críticos (9)** — entre otros:
- Registro permite elegir `role: "ADMIN"` (mass assignment) → escalada total.
- Contraseñas con MD5 sin sal; JWT con secreto por defecto `"secret"`; middleware que decodifica el JWT **sin verificar la firma**.
- Token de reseteo = `md5(email + timestamp)` e el endpoint **devuelve `requestedAt`** → toma de cuentas.
- SQL injection en `/api/products/search`, `/api/orders/search`, `/api/admin/reviews` y vía `X-Forwarded-For` en `/api/tracking`.
- `/api/files` sin autenticación y con path traversal → lectura de `.env.local`, BD, código.
- `/api/user/support-access` acepta cualquier `email` → sesión de soporte como cualquier usuario (incl. admin).

**Altos (10)** — IDOR en pedidos/wishlists, XSS almacenado (reseñas + IP en analytics + screenshot en soporte), SSRF en `/api/support`, contraseñas logueadas en claro y SIEM con `root`/`admin`, precio de pedido controlado por el cliente, share tokens con AES-CBC + clave por defecto, etc.

**Medios/bajos** — gift cards predecibles (LCG con semilla `Date.now()`), carrera en cupones, prompt injection en el asistente IA + `mcpServerUrl` controlado por el cliente, `next@15.2.2` y React con CVEs conocidos (incl. la línea CVE-2025-55182 que referencia tu `.env.local`), imagen Docker que empaqueta `.env.local` (no está en `.dockerignore`), etc.

**Notas:**
- No ejecuté explotación activa contra ninguna instancia; todo está verificado por lectura de código con referencias `archivo:línea`.
- El informe no reproduce los valores de secretos/flags (`QKB{...}`), solo indica su ubicación para rotación.
- Incluye prioridades de remediación (inmediato/2 semanas/medio plazo) y sección con los controles que sí están bien hechos (Zod casi en todo, `withAuth`, gift cards con comparación constante, etc.).
