# Auditoría de seguridad — Quokka Bazaar (v2.17.0)

Fecha: 2026-11-24 · Alcance: revisión estática de todo el código (Next.js 15.2.2, Prisma/SQLite, API routes, frontend, Docker, dependencias).
Método: lectura manual de configuración, `lib/`, `middleware.ts`, todas las rutas `app/api/**` y los puntos de riesgo del frontend, más `npm audit --omit=dev`. No se ejecutó la aplicación ni se hicieron pruebas dinámicas.

> **Nota de contexto:** el proyecto parece una aplicación **deliberadamente vulnerable** (contiene `flag.txt`, flags `QKB{...}`, tabla `Flag`, retos con CVE/CWE en `prisma/seed.ts`). Muchos hallazgos son intencionados. Este informe los trata igualmente como riesgos reales: **no debe desplegarse en un entorno expuesto**. Los valores de secretos se enmascaran en este documento.

## Resumen

| Severidad | Nº | Hallazgos |
|---|---|---|
| Crítica | 7 | C1–C7 |
| Alta | 9 | A1–A9 |
| Media | 8 | M1–M8 |
| Baja / informativa | 5 | B1–B5 |

Prioridades inmediatas: actualizar Next.js y React, eliminar la inyección SQL, corregir la asignación de rol en el registro, sacar secretos del repositorio y del bundle del cliente.

---

## Críticas

### C1. Inyección SQL (varios puntos)
Concatenación directa de entrada en SQL crudo:
- `app/api/products/search/route.ts` — `q` en `LIKE '%${query}%'` vía `$queryRawUnsafe` (**sin autenticación**).
- `app/api/orders/search/route.ts` — `status` en `AND o.status = '${status}'`.
- `app/api/admin/reviews/route.ts` — `author` en `db.exec(query)` de better-sqlite3, que ejecuta **múltiples sentencias** (stacked queries: escritura/borrado, no solo lectura).
- `app/api/tracking/route.ts` — `x-forwarded-for` (cabecera controlada por el cliente), `sessionId` y `userAgent` interpolados en un `INSERT` (**sin autenticación**). Además la consulta está truncada (`..., ` sin cierre), por lo que siempre falla y el registro de visitas no funciona.

El filtro que elimina filas con `qkb{` en la salida no es un control de seguridad.
**Corrección:** consultas parametrizadas (`prisma.product.findMany({ where: { OR: [{ name: { contains: q } }, ...] } })` o `$queryRaw` con plantillas etiquetadas); validar `status` con un enum de zod; usar `db.prepare(...).all(param)` y eliminar `db.exec`.

### C2. Escalada de privilegios en el registro (mass assignment)
`app/api/auth/signup/route.ts` acepta `role` del cuerpo y lo escribe en la BD (`userData.role = body.role`). Cualquiera puede crearse una cuenta `ADMIN`.
**Corrección:** ignorar `role` en el registro; asignar siempre `CUSTOMER`. Usar `.strict()` en el esquema.

### C3. Secreto JWT por defecto y MD5 sin sal
`lib/server-auth.ts`: `JWT_SECRET = process.env.JWT_SECRET || "secret"`. Como no hay `.env` con `JWT_SECRET` ni se define en Docker, en la práctica los tokens se firman con `"secret"` → cualquiera puede forjar un token de ADMIN. Además la comparación de firma usa `!==` (no constante en tiempo) y no hay `alg`/`iss`/`aud` verificados.
Contraseñas con **MD5 sin sal** (`hashMD5`), trivialmente crackeables; `prisma/seed.ts` incluye credenciales débiles (p. ej. `alice@example.com`).
**Corrección:** fallar al arrancar si falta `JWT_SECRET` (≥32 bytes aleatorios); `crypto.timingSafeEqual`; usar `jsonwebtoken` (ya es dependencia) o `jose`; migrar a argon2id/bcrypt.

### C4. Dependencias con vulnerabilidades críticas conocidas
- **`next@15.2.2`**: afectado por múltiples CVE, entre ellos el bypass de middleware CVE-2025-29927 (cabecera `x-middleware-subrequest`, corregido en 15.2.3) y varios posteriores. `npm audit` lo marca como crítico.
- **`react@19.2.0` / `react-dom@19.2.0`**: rango afectado por **CVE-2025-55182** (RCE en React Server Components, «React2Shell»); corregido en 19.2.1. El propio `.env.local` nombra `FLAG_CVE_2025_55182`.
- `tar <=7.5.20` (crítico), `zod <4.6.6` (alto, DoS de memoria), `prisma` / `@prisma/config`, `sharp`, `postcss`, `nanoid`, etc.
Total `npm audit`: 21 (2 críticas, 11 altas, 8 moderadas).
**Corrección:** subir Next y React a versiones parcheadas, `npm audit fix`, y habilitar Dependabot/Renovate.

### C5. XXE en importación de pedidos de proveedor
`app/api/admin/suppliers/import-order/route.ts` parsea XML con `libxmljs.parseXmlString(rawXml, { noent: true, dtdload: true })`: resuelve entidades externas y DTD → lectura de ficheros locales (`/etc/passwd`, `supplier-registry.txt`, `.env.local`) y SSRF. Los errores devuelven la ruta de configuración en `debug.config`. Requiere ADMIN, pero ver C2/C3.
**Corrección:** `noent: false`, `dtdload: false`, `nonet: true`; no devolver rutas internas.

### C6. Fuga de secretos y credenciales en el repositorio / cliente
- `.env.local` (no ignorado por `.gitignore`, que solo ignora `.env`) contiene `NEXT_PUBLIC_PAYMENT_SECRET` y un valor `FLAG_*`. El prefijo `NEXT_PUBLIC_` **incrusta el valor en el JavaScript del navegador** y `CheckoutClient.tsx` lo envía en `X-Payment-Auth`: no es un secreto. Además `/api/orders` no valida esa cabecera (control inexistente) y el `total` lo fija el cliente (ver A4).
- `supplier-registry.txt`: `api_key=QKB{…}` en la raíz del proyecto (se copia a la imagen Docker).
- `lib/live-stream.ts`: `streamKey` RTMP y URL de ingesta en código.
- `app/api/admin/diag/route.ts`: token de depuración fijo (`dbg_8f3a…`) en el fuente; `app/admin/documents/page.tsx` filtra en un comentario HTML cómo se conecta.
- `monitoring/auth` y `monitoring/logs`: credenciales `root` / `admin` en código; la cookie `siem_session=authenticated` es un valor fijo y fácil de falsificar.
- `lib/share-crypto.ts`: clave AES por defecto embebida en código.
- `lib/prompt` del asistente (`ai-assistant/route.ts`): «código de validación interno» en el prompt del sistema.
- `public/notice.txt` y `flag.txt`: contenido sensible servido o presente en la raíz.
**Corrección:** rotar todo lo expuesto, mover a variables de entorno de servidor / gestor de secretos, añadir `.env*` a `.gitignore` y `.dockerignore`, quitar `NEXT_PUBLIC_` de secretos.

### C7. Inclusión/lectura arbitraria de ficheros (path traversal)
`app/api/files/route.ts` (**sin autenticación**): `join(baseDir, file)` y `join(baseDir, dirPath)` sin comprobar que el resultado siga bajo `documents/`. `?file=../.env.local`, `?file=../flag.txt` o `?list=true&path=../..` permiten leer y listar cualquier fichero del servidor (incluido `logs/app.log` con contraseñas, ver A1).
**Corrección:** `path.resolve` + comprobar `startsWith(baseDir + sep)`, lista blanca de extensiones, exigir autenticación.

---

## Altas

### A1. Contraseñas en texto claro en los logs
`app/api/auth/login/route.ts` registra `email` y `password` (y en el mensaje) con `logger.warn`. `logs/app.log` es legible vía C7 y vía `/api/monitoring/logs` (credenciales fijas, C6). Además el log expone al instante los intentos de usuarios legítimos.
**Corrección:** no registrar credenciales; enmascarar con `pino` `redact`.

### A2. SSRF en `/api/support` y en el asistente de IA
- `app/api/support/route.ts` (**sin autenticación**) hace `fetch(screenshotUrl)` con una URL arbitraria y devuelve el cuerpo; el cliente lo renderiza con `dangerouslySetInnerHTML` (ver A3). Permite acceder a `localhost`, metadatos cloud y red interna.
- `app/api/ai-assistant/route.ts` descubre y llama a herramientas MCP en una `mcpServerUrl` suministrada por el usuario (SSRF + inyección de prompt indirecta: las descripciones de herramientas externas llegan al LLM, que puede invocar `get_compliance_report` con la sesión interna). El filtro de «prompt injection» son 4 regex fácilmente evadibles. El `apiKey` de Mistral del usuario viaja en el cuerpo y se guarda en `localStorage`.
**Corrección:** lista blanca de hosts, bloquear rangos privados/loopback y redirecciones, sin devolver el cuerpo crudo.

### A3. XSS
- `app/support/SupportForm.tsx`: `dangerouslySetInnerHTML` con contenido remoto (de A2).
- `app/admin/analytics/AnalyticsClient.tsx:366`: `dangerouslySetInnerHTML={{ __html: visit.ip }}`. `visit.ip` procede de la cabecera `x-forwarded-for` controlada por el atacante → **XSS almacenado ejecutado en el navegador del administrador**.
- Reseñas (`products/[id]/reviews`) permiten fijar `author` arbitrario y se muestran al admin: verificar escapado.
**Corrección:** renderizar como texto, o sanear con DOMPurify; ignorar `x-forwarded-for` si no hay proxy de confianza.

### A4. Falta de control de acceso / IDOR
- `GET /api/orders/[id]`: cualquier usuario autenticado lee cualquier pedido (nombre, email y dirección de entrega) — no se comprueba `order.userId`.
- `GET /api/wishlists/[id]`: no respeta `isPublic` ni propietario.
- `POST /api/live/stream`: cualquier usuario autenticado reemplaza el vídeo de la emisión pública (`hijacked` solo se registra, no se bloquea).
- `POST /api/user/support-access`: acepta `email` de **otro usuario** y genera un token de acceso que permite iniciar sesión como esa víctima (incluido admin) sin su contraseña; el token vale 365 días y la sesión resultante otros 365 días.
- `GET /api/flags`, `/api/flags/[slug]`: exponen todas las flags/respuestas sin autenticación.
- `POST /api/orders`: el `total` lo envía el cliente (se puede pagar 0) y el cupón tiene una condición de carrera (check-then-increment con `setTimeout`), por lo que puede canjearse varias veces.
**Corrección:** comprobar propiedad/rol en cada recurso; calcular totales en servidor; transacciones atómicas para cupones.

### A5. Restablecimiento de contraseña predecible
`auth/forgot-password`: `token = md5(email + timestamp_segundos)`; la respuesta devuelve `requestedAt` con el segundo exacto, así que el atacante calcula el token y toma cualquier cuenta (incluida la de admin). No hay límite de intentos.
**Corrección:** `crypto.randomBytes(32)`, almacenar solo el hash, enviar por correo, no devolver `requestedAt`.

### A6. Códigos de tarjetas regalo predecibles
`lib/gift-card.ts` genera el código con un LCG (`seed = createdAt.getTime()`, que se devuelve al usuario en `createdAt`); el código puede reconstruirse a partir de la marca de tiempo y canjear saldo ajeno. `redeem` carga todos los códigos pendientes y no limita intentos (fuerza bruta).
**Corrección:** `crypto.randomBytes`, límite de intentos, y vínculo de la tarjeta al destinatario.

### A7. Cifrado de enlaces compartidos débil
`lib/share-crypto.ts`: AES-256-CBC **sin autenticación** (padding oracle / maleabilidad) con clave por defecto pública en el código. Con la clave por defecto cualquiera puede forjar tokens `order:<id>` o `report:internal` y leer datos (incluido dirección) de cualquier pedido en `/api/documents/share`.
**Corrección:** AES-256-GCM con clave obligatoria de entorno, o tokens aleatorios guardados en BD con caducidad.

### A8. Middleware de autorización insuficiente y decodificación sin verificación de firma
`middleware.ts` solo protege `/monitoring/internal-status`, y **decodifica el JWT sin verificar la firma** (basta con un token con `"role":"ADMIN"` sin firmar correctamente). Las páginas `/admin/*` se protegen solo con redirecciones en el cliente (`router.push("/login")`); los datos sí lo están en la API (`withAdminAuth`), pero las páginas y su código se sirven igualmente.
**Corrección:** verificar la firma en el middleware (con `jose` en Edge) y ampliar el `matcher` a `/admin/*`, `/monitoring/*`.

### A9. Exposición de información en errores
`/api/user/export` devuelve `systemDiagnostics` con versión de Node, `stack` y valores de flags cuando el usuario envía campos inválidos; permite exportar el campo `password` (hash MD5). `/api/admin/*` y `import-order` devuelven rutas internas. Los campos `fields` aceptan cualquier tipo (`z.unknown()`).
**Corrección:** errores genéricos al cliente, detalles solo en logs; eliminar `password` de los campos exportables.

---

## Medias

- **M1. Sin rate limiting / bloqueo** en login, signup, forgot/reset password, canje de tarjetas, cupones. Login distingue «usuario no existe» de «contraseña inválida» (enumeración de usuarios); signup también (409).
- **M2. Sin protección CSRF explícita**: se apoya solo en `SameSite=Lax`; `PATCH/POST` aceptan `application/x-www-form-urlencoded` (`user/profile`, `orders/[id]`), lo que habilita CSRF cruzado simple.
- **M3. Cookies y sesiones**: JWT de 7 días sin revocación ni rotación; `siem_session` sin `secure`/`sameSite`; sesión de soporte de 365 días; logout no invalida nada del servidor.
- **M4. Subida de ficheros** (`admin/products/[id]/image`): admite `image/svg+xml` y confía en `file.type` (cabecera del cliente), no en el contenido; `/api/uploads` sirve SVG con `Content-Type: image/svg+xml` en el mismo origen → XSS almacenado vía SVG con `<script>`. Falta `Content-Disposition`/CSP/`nosniff`.
- **M5. `/api/uploads/[...path]`** filtra `..` pero no valida más; riesgo bajo, mejor `resolve + startsWith`.
- **M6. Sin cabeceras de seguridad** (CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS, `Referrer-Policy`) en `next.config.ts`.
- **M7. Validación de entrada débil**: los esquemas zod son casi todos `z.string()` sin longitud/formato (`email` sin validar, `signup` con `.passthrough()`, sin política de contraseña en el registro).
- **M8. Fallos de integridad en pedidos**: generación de ID `ORD-nnn` con lectura de todos los pedidos y reintentos (carrera, escalado O(n)); `redirect` de `login` es `unknown` y activa una cookie auxiliar `oauth_callback` sin validar.

## Bajas / informativas

- **B1.** Docker: la imagen corre como **root**, sin `USER`; copia `.env.local`, `flag.txt`, `supplier-registry.txt` y la BD (`COPY . .`; `.dockerignore` no los excluye); `node:20-alpine` sin versión fijada; `docker-compose` carga `.env.local` en el contenedor y expone el puerto en todas las interfaces.
- **B2.** `scripts/setup.sh` lanza **Prisma Studio** sin autenticación (puerto 5555) junto con la app.
- **B3.** `next.config.ts`: `remotePatterns` correcto, pero `libxmljs2` (nativo, con historial de CVE) está en la lista de externos.
- **B4.** `instrumentation.node.ts` sustituye `console.*` y escribe todo (incluidos objetos serializados) en `logs/app.log` sin rotación ni redacción.
- **B5.** El repositorio no es un repo git (`Is a git repository: false`): sin historial no se puede comprobar si los secretos ya se publicaron; asumir que sí.

---

## Plan de remediación sugerido

1. **Inmediato (hoy):** actualizar `next` y `react`/`react-dom`; rotar y retirar secretos (`.env.local`, `supplier-registry.txt`, claves RTMP/SIEM/diag/AES); exigir `JWT_SECRET`; arreglar signup (C2).
2. **Esta semana:** parametrizar todas las consultas SQL (C1), corregir path traversal (C7) y XXE (C5), IDOR (A4), reseteo de contraseña (A5), dejar de registrar contraseñas (A1).
3. **Corto plazo:** migrar hashing a argon2id, GCM para los tokens compartidos, bloquear SSRF, sanear HTML, rate limiting, cabeceras de seguridad/CSP, middleware con verificación de firma.
4. **Continuo:** Dependabot/`npm audit` en CI, SAST (CodeQL/Semgrep), contenedor no-root, pruebas de autorización automatizadas.

## Limitaciones

Revisión estática solamente; no se comprobó la explotabilidad en una instancia en ejecución, ni se auditaron las páginas cliente una a una ni el contenido de `lib/validation/index.ts` y de la base de datos sembrada. Las versiones concretas de las CVE de Next.js/React deben verificarse contra los avisos oficiales antes de elegir la versión objetivo.
