# Auditoría de Seguridad — Quokka Bazaar (Next.js 15.2.2 / Prisma / SQLite)

- **Fecha:** 2026-11-24
- **Alcance:** código fuente completo (`app/`, `lib/`, `hooks/`, `prisma/`, `middleware.ts`, config de Docker), 60+ rutas API, frontend React, esquema de base de datos y archivos de configuración/secrets.
- **Metodología:** revisión manual de código (estática), análisis de flujo de autenticación/autorización, revisión de inyección, gestión de secretos, exposición de datos y configuración de despliegue.

---

## 1. Resumen ejecutivo

La aplicación presenta **múltiples vulnerabilidades CRÍTICAS que comprometen por completo la confidencialidad, integridad y disponibilidad** del sistema y de los datos de los usuarios:

1. **Inyección SQL** en al menos 4 endpoints (uno de ellos público y sin autenticación) mediante `$queryRawUnsafe` / `better-sqlite3` con interpolación directa de strings.
2. **XXE** (XML External Entity) en la importación de pedidos de proveedores (`libxmljs2` con `noent`/`dtdload` habilitados).
3. **Secretos hardcodeados y commiteados**: secreto JWT por defecto `"secret"`, clave AES de share tokens por defecto, credenciales SIEM `root/admin`, token de diagnóstico, claves en `.env.local`, `supplier-registry.txt`, `flag.txt` y `public/notice.txt`. `.env.local` **no está en `.gitignore` ni en `.dockerignore`**, por lo que se filtra al repositorio y a la imagen Docker.
4. **Hashing de contraseñas MD5 sin salt**.
5. **Mass assignment de rol** en el registro: cualquier usuario puede crearse una cuenta `ADMIN`.
6. **XSS almacenado** (reviews renderizadas con `innerHTML` + re-ejecución de `<script>`; IPs inyectadas vía `dangerouslySetInnerHTML` en el panel admin; contenido de URL arbitraria vía SSRF en soporte). Subida y servicio de **SVG** (XSS desde el propio origen).
7. **SSRF** en `/api/support` (fetch de URL arbitraria con cabecera interna) y en el asistente de IA (acepta `mcpServerUrl` controlado por el usuario).
8. **IDOR / falta de autorización a nivel de objeto** en pedidos y wishlists; endpoint de compartir documentos sin autenticación y con criptografía forgeable (AES-256-CBC sin firma y clave por defecto conocida).
9. **Path traversal / lectura arbitraria de archivos** en `/api/files` (sin protección contra `..`), que expone `.env.local`, la base de datos SQLite, etc.
10. **Endpoints internos accesibles públicamente**: `/api/flags*` devuelve todos los secretos de la BD sin autenticación; `/internal` se "protege" con una cabecera `x-internal-request` que el propio cliente puede enviar; el middleware decodifica el JWT **sin verificar la firma**.
11. **Credenciales en logs en texto plano** (la contraseña se loguea en `/api/auth/login`) y logs accesibles vía `/api/monitoring/logs` con credenciales débiles hardcodeadas.
12. **Tokens predecibles**: gift cards (LCG con seed = timestamp) y reset de contraseña (`MD5(email+timestamp)`).
13. **Dependencia crítica conocida**: `next@15.2.2` es vulnerable a **CVE-2025-55182 (React2Shell, RCE)** — el propio `.env.local` contiene `FLAG_CVE_2025_55182`.
14. **Prompt injection / tool abuse** en el asistente de IA: filtro de 4 regex trivial, system prompt con códigos internos, y reenvío de la cabecera de sesión interna al MCP habilita la exfiltración de flags vía `get_compliance_report`.

**Veredicto:** la aplicación **NO es apta para producción** en su estado actual. Un atacante externo sin credenciales puede, como mínimo: extraer toda la base de datos vía SQLi, leer archivos arbitrarios del servidor, crear cuentas admin, robar sesiones mediante XSS y ejecutar código remoto explotando la versión vulnerable de Next.js.

---

## 2. Hallazgos por severidad

### 2.1 CRÍTICOS

#### C-1. Inyección SQL en endpoints públicos/autenticados — CWE-89 / OWASP A03
- `app/api/products/search/route.ts:85-100` — endpoint **público (sin auth)**: `q` se interpola directamente en `WHERE name LIKE '%${query}%'` y se ejecuta con `prisma.$queryRawUnsafe`. Permite UNION-based extraction de toda la tabla `users` (incl. hashes MD5 de contraseñas), `flags`, `support_access_tokens`, etc.
- `app/api/orders/search/route.ts:81-102` — `status` interpolado en SQL vía `$queryRawUnsafe` (autenticado, pero cualquier usuario).
- `app/api/tracking/route.ts:97-103` — endpoint **público**: `ip` (cabecera `X-Forwarded-For`, totalmente controlable por el cliente), `sessionId`, `userAgent` y `path` se interpolan en un `INSERT` con `$queryRawUnsafe`. Solo se escapan comillas simples de algunos campos; `ip` y `sessionId` no tienen ningún escape → inyección directa sin autenticación.
- `app/api/admin/reviews/route.ts:103-120` — `authorFilter` interpolado en `db.exec(query)` (better-sqlite3). Un admin (o un atacante con cuenta admin creada vía C-5) puede ejecutar SQL arbitrario; en SQLite `exec` permite sentencias múltiples y operaciones como `ATTACH DATABASE`.
- **Impacto:** exfiltración total de la BD, modificación/borrado de datos, lectura de archivos (SQLite `readfile()` si está habilitada), DoS.
- **Corrección:** usar consultas parametrizadas (`prisma.$queryRaw` con tagged templates / `Prisma.sql`) o el query builder de Prisma (`contains`/`startsWith`); nunca `$queryRawUnsafe` con entrada del usuario. Validar/normalizar `X-Forwarded-For` (tomar solo la última IP de confianza del proxy).

#### C-2. XXE en importación XML de proveedores — CWE-611
- `app/api/admin/suppliers/import-order/route.ts:21-24`: `libxmljs.parseXmlString(rawXml, { noent: true, dtdload: true })` resuelve entidades externas y carga DTDs externas → lectura de archivos locales (`file:///etc/passwd`, `.env.local`, la propia `dev.db`) y denegación de servicio por expansión de entidades ("billion laughs").
- **Corrección:** deshabilitar `noent` y `dtdload`, o usar `noent:false, dtdload:false` y rechazar documentos con `<!DOCTYPE`/`<!ENTITY`;限制 entity expansion.

#### C-3. Secreto JWT por defecto conocido → falsificación de tokens admin — CWE-798 / CWE-347
- `lib/server-auth.ts:12`: `const JWT_SECRET = process.env.JWT_SECRET || "secret"`. Si `JWT_SECRET` no está definida (no aparece en `.env.local`), cualquiera puede firmar un JWT HS256 con `role: "ADMIN"` y tomar control total (`withAdminAuth` confía en el claim `role` del token).
- **Corrección:** exigir `JWT_SECRET` en el arranque (fail-fast) con longitud mínima (>= 32 bytes aleatorios); usar RS256 asimétrico; no confiar en claims de rol sin verificar contra la BD.

#### C-4. Mass assignment de rol en el registro — CWE-915
- `app/api/auth/signup/route.ts:59-61` + `lib/validation/schemas/auth.ts:3-9` (`.passthrough()` y `role` aceptado): el cliente puede enviar `{ "email": "x@x.com", "password": "...", "role": "ADMIN" }` y obtener una cuenta administradora.
- **Corrección:** eliminar `role` del schema de signup (whitelist estricta con `z.strictObject`); el rol solo debe asignarse server-side.

#### C-5. Contraseñas hasheadas con MD5 sin salt — CWE-916 / CWE-327
- `lib/server-auth.ts:14-16` (`hashMD5`) usada en login, signup y reset-password. MD5 es trivialmente rompible con rainbow tables/GPU; sin salt, dos usuarios con la misma contraseña comparten hash.
- **Corrección:** `argon2id` o `bcrypt` (cost >= 12) vía p. ej. `better-auth`, `lucia` o `argon2` npm.

#### C-6. Lectura arbitraria de archivos (path traversal) en `/api/files` — CWE-22
- `app/api/files/route.ts:19-67` — **sin autenticación**. `join(baseDir, file)` y `join(baseDir, dirPath)` no comprueban `..` (a diferencia de `/api/uploads`). `GET /api/files?file=../../.env.local` o `?list=true&path=../../../` expone secretos, la base de datos SQLite (`prisma/dev.db` o `/app/data/dev.db`), logs, etc.
- **Corrección:** validar con `path.resolve` y comprobar que el resultado comienza con `baseDir + path.sep`; rechazar `..`, null bytes y rutas absolutas; requerir autenticación y autorización por recurso.

#### C-7. Exposición pública de secretos vía `/api/flags*` — CWE-200
- `app/api/flags/route.ts`, `app/api/flags/[slug]/route.ts`: devuelven **todos** los registros de la tabla `flags` (que contiene los valores `QKB{...}` sembrados en `prisma/seed.ts`) sin ningún tipo de autenticación.
- **Corrección:** eliminar estos endpoints de producción o protegerlos con admin auth; no almacenar secretos/flags en la BD de la aplicación.

#### C-8. Endpoint de documentos compartidos sin auth + criptografía forgeable — CWE-306 / CWE-353
- `app/api/documents/share/route.ts` no requiere autenticación y confía en un token AES-256-**CBC sin firma** (`lib/share-crypto.ts`) cuya clave por defecto está hardcodeada (`a1b2c3...`, línea 6-10). Cualquiera con esa clave puede **forjar** tokens `order:<id>` / `report:internal` y leer pedidos de cualquier usuario (nombre, dirección completa, artículos, total). CBC sin MAC también es vulnerable a padding-oracle si el endpoint distinguiera errores (aquí devuelve 400 genérico, pero la forja es suficiente).
- **Corrección:** usar AES-256-**GCM** (o firma HMAC sobre el token) con clave desde entorno obligatoria; requerir autenticación o al menos tokens opacos aleatorios almacenados en BD con expiración y revocación.

#### C-9. XSS almacenado (reviews) con re-ejecución de scripts — CWE-79
- `app/products/[id]/ProductDetailClient.tsx:51-67`: el contenido de las reviews se inyecta vía `innerHTML` y además se **re-crean y re-ejecutan los elementos `<script>`**. Cualquier usuario puede publicar una review con `<script>` que robe datos de sesión (la cookie es httpOnly, pero permite Actions autenticadas, exfiltración de datos del DOM y phishing). La API de reviews (`app/api/products/[id]/reviews/route.ts`) no sanitiza el contenido.
- **Corrección:** renderizar con React/`react-markdown` (nunca `innerHTML` con contenido de usuarios); sanitizar server-side (DOMPurify) y aplicar CSP.

#### C-10. XSS vía `dangerouslySetInnerHTML` con datos controlados por el atacante — CWE-79
- `app/admin/analytics/AnalyticsClient.tsx:366`: `dangerouslySetInnerHTML={{ __html: visit.ip }}` — la IP proviene de `X-Forwarded-For` (`app/api/tracking/route.ts:58-59`), que el atacante controla → XSS dirigido al panel de administración (robo de sesión de admin en acciones, defacement, keylogging).
- `app/support/SupportForm.tsx:103-107`: `screenshotContent` se renderiza con `dangerouslySetInnerHTML`; proviene de una URL arbitraria (ver C-11) → XSS almacenado en la página de soporte.
- `app/admin/documents/page.tsx:12`: HTML oculto inyectado (comentario con nota interna filtrada al HTML público).
- **Corrección:** nunca `dangerouslySetInnerHTML` con datos de terceros; usar texto plano (`{visit.ip}`).

#### C-11. SSRF en `/api/support` — CWE-918
- `app/api/support/route.ts:14-27`: hace `fetch(screenshotUrl)` a cualquier URL (incl. `http://169.254.169.254/...`, `file://` según el runtime, servicios internos) y devuelve el contenido al cliente, añadiendo la cabecera interna `X-Internal-Request: true` que otras rutas usan como "prueba" de internalidad (`app/internal/page.tsx:17`).
- **Corrección:** allowlist de dominios, resolución DNS + bloqueo de rangos privados/link-local, timeouts, límite de tamaño, y no devolver el body crudo al cliente.

#### C-12. SSRF / tool abuse en el asistente de IA — CWE-918 / prompt injection
- `app/api/ai-assistant/route.ts:200-212`: acepta `mcpServerUrl` del usuario y hace `fetch` a esa URL (SSRF) exponiendo sus "tools" al LLM; además reenvía la cabecera de sesión interna (`X-MCP-Session: quokka-internal-agent`, `lib/mcp-constants.ts`) al MCP interno, desbloqueando `get_compliance_report` que devuelve flags de la BD (`app/api/mcp/route.ts:142-163`).
- El filtro anti prompt-injection (`lib/prompt-injection-filter.ts`) son 4 regex triviales (`ignore.*previous.*instructions`, etc.) fácilmente evadibles; el system prompt filtra un código interno `QKB{...}` (línea 22).
- **Corrección:** no aceptar URLs externas de MCP; no reenviar credenciales internas; tratar toda respuesta de tools como datos no confiables; usar un modelo de permisos real en lugar de regex.

#### C-13. Credenciales hardcodeadas y accesibles — CWE-798
- SIEM: `root` / `admin` en `app/api/monitoring/auth/route.ts:5-6` y `app/api/monitoring/logs/route.ts:7-8`; la cookie `siem_session=authenticated` es un valor estático adivinable.
- Token de diagnóstico `dbg_8f3a7c91e2b4d6a05e21` en `app/api/admin/diag/route.ts:6` (endpoint "admin" sin `withAdminAuth`).
- `X-MCP-Session: quokka-internal-agent` en `lib/mcp-constants.ts` — cualquiera que lo lea del código puede llamar `get_compliance_report`.
- **Corrección:** mover todo a variables de entorno obligatorias, rotación, hash de contraseñas para el SIEM, sesiones firmadas server-side, y eliminar endpoints de diagnóstico de producción.

#### C-14. Secretos en el repositorio y en la imagen Docker — CWE-798 / CWE-532
- `.env.local` (con `NEXT_PUBLIC_PAYMENT_SECRET` y un flag) **no está en `.gitignore`** (solo `.env`) ni en `.dockerignore` → `COPY . .` en el `Dockerfile` la mete en la imagen.
- `flag.txt`, `supplier-registry.txt` (`api_key=QKB{...}`), `public/notice.txt` (servido estáticamente en `/notice.txt`), `prisma/seed.ts` (35+ flags), comentario en `app/admin/documents/page.tsx`.
- `NEXT_PUBLIC_PAYMENT_SECRET` se inyecta en el bundle del cliente (`app/checkout/CheckoutClient.tsx:119`) — todo `NEXT_PUBLIC_*` es público por definición.
- **Corrección:** rotar todos estos secretos YA; añadir `.env*`, `flag.txt`, `supplier-registry.txt` a `.gitignore`/`.dockerignore`; nunca usar `NEXT_PUBLIC_` para secretos; purgar el historial de git.

#### C-15. Contraseñas en texto plano en los logs — CWE-532
- `app/api/auth/login/route.ts:16-25`: `logger.warn({ email, password, ... }, "...password=${password}...")` escribe la contraseña en `logs/app.log`, y ese archivo es legible vía `/api/monitoring/logs` (C-13) y vía path traversal (C-6).
- **Corrección:** no loguear NUNCA credenciales; revisar `logs/app.log` y rotar las contraseñas expuestas.

#### C-16. Dependencia crítica: Next.js 15.2.2 vulnerable a CVE-2025-55182 (RCE) — CWE-1104
- `package.json` fija `next@15.2.2`. CVE-2025-55182 ("React2Shell") permite ejecución remota de código sin autenticación en servidores Next.js expuestos. El propio entorno lo confirma (`FLAG_CVE_2025_55182` en `.env.local`).
- **Corrección:** actualizar inmediatamente a la versión parcheada (>= 15.2.5 / 15.5.x según advisory) y auditar `npm audit` periódicamente.

#### C-17. Subida y servicio de SVG (XSS desde el origen) — CWE-79
- `app/api/admin/products/[id]/image/route.ts:14` permite `image/svg+xml`; `app/api/uploads/[...path]/route.ts:12` lo sirve con `Content-Type: image/svg+xml` desde el mismo origen → un SVG con `<script>` se ejecuta en el dominio de la app al abrirse directamente.
- **Corrección:** excluir SVG o servirlo con `Content-Disposition: attachment` y `Content-Security-Policy: sandbox`; sanitizar SVG; idealmente convertir a raster.

### 2.2 ALTOS

#### A-1. IDOR en pedidos y wishlists — CWE-639
- `app/api/orders/[id]/route.ts:12-24`: cualquier usuario autenticado puede leer **cualquier** pedido (no comprueba `order.userId === user.id`): filtra email del cliente y dirección completa de entrega.
- `app/api/wishlists/[id]/route.ts:10-24`: no comprueba `userId` ni `isPublic` → filtra el email del propietario y sus productos.
- **Corrección:** verificar propiedad en todas las lecturas/modificaciones (el endpoint DELETE de wishlists sí lo hace bien; replicar el patrón).

#### A-2. Autenticación rota en middleware y página "interna" — CWE-347 / CWE-840
- `middleware.ts:3-20`: `decodeJWT` **no verifica la firma** (solo decodifica el payload y mira `exp`);Any token con 3 partes y `role=ADMIN` en base64 pasa el check de `/monitoring/internal-status`.
- `app/internal/page.tsx:17-21`: la página "interna" se "protege" con la cabecera `x-internal-request: true`, que cualquier cliente puede enviar.
- **Corrección:** verificar firma HS256/RS256 con la librería adecuada en el middleware (o delegar a la capa de rutas); no usar cabeceras enviadas por el cliente como prueba de internalidad (usar mTLS/saltos de red internos).

#### A-3. Tokens predecibles — CWE-340 / CWE-330
- Gift cards: `lib/gift-card.ts` genera códigos con un LCG cuyo seed es `Date.now()` en ms (`app/api/gift-cards/route.ts:52`) → dado un código conocido se pueden derivar otros y redimir saldo ajeno.
- Reset de contraseña: `hashMD5(email + timestamp)` (`app/api/auth/forgot-password/route.ts:22`) → adivinable si se conoce el email y la ventana temporal; además `forgot-password` filtra `requestedAt` en la respuesta (oráculo de tiempo) y login distingue "Invalid credentials" vs "Invalid password" (enumeración de usuarios).
- **Corrección:** `crypto.randomBytes(32+)` para códigos y tokens; mensajes de error genéricos; rate limiting.

#### A-4. Sin rate limiting ni protección CSRF — CWE-770 / CWE-352
- Login, forgot-password, signup, redeem y tracking no tienen rate limiting → fuerza bruta y enumeración.
- Las cookies usan `SameSite=lax` pero no hay tokens CSRF ni `Origin` check en los POST que cambian estado (pedidos, perfil, support-access) → CSRF posible vía sitios externos en navegadores que respeten lax para top-level POST (formularios).
- **Corrección:** rate limiting por IP/usuario (p. ej. `@upstash/ratelimit`), `SameSite=strict` para sesión, validación de `Origin`/`Sec-Fetch-Site`, tokens CSRF en formularios sensibles.

#### A-5. Fuga de información en respuestas de error — CWE-209
- `app/api/user/export/route.ts:77-92,130-141`: en error devuelve `systemDiagnostics` (incluye flags de la BD `case-d79d12`, versión de Prisma, `NODE_ENV`, y en fallo de DB el `stack` y `message`). Y `ALLOWED_USER_FIELDS` incluye `password` — un usuario puede exportar **su propio hash MD5**, y el endpoint devuelve `debug.systemDiagnostics.featureFlags` (un flag) en respuestas de error a cualquier usuario autenticado.
- **Corrección:** nunca devolver stacks/diagnósticos al cliente; eliminar `password` de los campos exportables.

#### A-6. Condición de carrera (TOCTOU) en cupones — CWE-367
- `app/api/orders/route.ts:64-88` y `app/api/coupon/apply/route.ts`: check (`usedCount < maxUses`) seguido de `update` con un `setTimeout` de 150 ms entre medias → un cupón de uso único puede redimirse en paralelo N veces.
- **Corrección:** `UPDATE ... SET usedCount = usedCount + 1 WHERE code = ? AND usedCount < maxUses` y comprobar `count === 1` (update condicional atómico).

#### A-7. IDs de pedido secuenciales y lógica de reintento insegura — CWE-330
- `app/api/orders/route.ts:112-137`: IDs `ORD-001...` predecibles (combinado con A-1, enumeración trivial) y bucle de reintento que recalcula el siguiente ID consultando toda la tabla.
- **Corrección:** UUIDs/CUIDs; generación atómica con retry sobre colisión real.

#### A-8. Sesiones excesivamente largas y cookie de soporte de 1 año — CWE-613
- Login: token JWT de 7 días; support-login emite sesión de **365 días** (`app/api/auth/support-login/route.ts:47`) con `supportAccess: true`, y `POST /api/user/support-access` permite a CUALQUIER usuario autenticado crear un token de soporte **para otro email** (`targetEmail`, líneas 58-67) → suplantación de cuentas mediante `/support-login?token=...`.
- **Corrección:** expiraciones cortas + refresh tokens; el soporte debe crearse solo para el propio usuario o por admin con auditoría; revocar tokens al cambiar contraseña.

#### A-9. Sin cabeceras de seguridad — CWE-693
- `next.config.ts` no define CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS, etc.
- **Corrección:** añadir cabeceras globales (CSP estricta sin `unsafe-inline` para scripts, `frame-ancestors 'none'`, etc.).

### 2.3 MEDIOS

#### M-1. Datos sensibles del usuario en `localStorage` — CWE-922
- `lib/client-auth.ts` y varios componentes guardan el objeto `user` (con `role`) en `localStorage`; la API key de Mistral se guarda en `localStorage` (`app/support/ai-assistant/AIAssistantChat.tsx:25-44`) → robo vía XSS.
- **Corrección:** no almacenar datos sensibles ni claves en localStorage; usar cookies httpOnly.

#### M-2. Enumeración de usuarios y oráculos de tiempo — CWE-204
- Login distingue "Invalid credentials"/"Invalid password"; forgot-password devuelve `requestedAt`.
- **Corrección:** respuesta única genérica; tiempos de respuesta uniformes.

#### M-3. Sin límite de tamaño de body ni validación de schémas estricta — CWE-400
- `signupBodySchema` usa `.passthrough()`; varios endpoints hacen `request.json()` sin límite; `parseBody` no limita tamaño.
- **Corrección:** `z.strictObject`, límite de body (p. ej. 1 MB), límite de campos.

#### M-4. Configuración de despliegue insegura — CWE-16
- `Dockerfile` copia todo el repo (incluido `.env.local`, `flag.txt`, `supplier-registry.txt` — ver C-14); `docker-compose.yml` carga `.env.local`; `scripts/setup.sh` abre Prisma Studio (puerto 5555) y la app sin TLS; `docker-entrypoint.sh` ejecuta `prisma db push` y seed en producción.
- **Corrección:** imágenes multi-stage mínimas, `.dockerignore` completo, no exponer 5555, TLS terminado en proxy inverso, migraciones controladas.

#### M-5. "Filtro" de flags en respuestas SQL — CWE-184
- Varias rutas filtran valores que contienen `qkb{` de los resultados (products/search, orders/search, admin/reviews). Es ofuscación, no seguridad: el SQLi subyacente sigue permitiendo extraer todo (p. ej. con funciones de SQL que no devuelvan el literal, o leyendo otras tablas).
- **Corrección:** corregir el SQLi de raíz; no almacenar secretos en tablas accesibles.

#### M-6. Versión de `libxmljs2` y otras dependencias a auditar — CWE-1104
- `libxmljs2@0.37.0`, `jsonwebtoken@9.0.3`, `better-sqlite3@12.6.2`: ejecutar `npm audit` y actualizar; `jsonwebtoken` 9.x tiene advisories sobre verificación de algoritmos — aquí la verificación es manual con HMAC fijo (ver C-3).

#### M-7. Logs accesibles y con PII — CWE-532
- `/api/monitoring/logs` lee `logs/app.log` completo (con passwords, ver C-15, emails, IPs, user-agents) con auth débil (C-13).
- **Corrección:** auth robusta, filtrar campos sensibles en el logger, retención y acceso restringido.

### 2.4 BAJOS / OBSERVACIONES

- **B-1.** `middleware.ts` solo cubre `/monitoring/internal-status`; el resto de rutas "protegidas" dependen de `withAuth` por ruta — fácil olvidar una (p. ej. `/api/admin/diag` no usa `withAdminAuth`).
- **B-2.** `GET /api/products` y `GET /api/products/[id]/reviews` son públicos y devuelven todos los productos/reviews sin paginación ni rate limit.
- **B-3.** `signHS256` usa comparación `!==` de strings en `decodeSessionToken` (`lib/server-auth.ts:41`) → ataque de timing teórico; usar `crypto.timingSafeEqual`.
- **B-4.** Cookie `secure` solo en production (`NODE_ENV === "production"`); asegurar TLS en todos los entornos.
- **B-5.** `app/api/live/stream/route.ts` permite a cualquier usuario autenticado cambiar el video del live público (ya lo detecta como "hijacked" y lo loguea, pero igualmente lo aplica) → defacement de la emisión pública.
- **B-6.** `eslint-config-next@16` con `next@15` (mezcla de versiones) — mantener coherencia.

---

## 3. Matriz de control de acceso por endpoint (resumen)

| Endpoint | Auth | Problema principal |
|---|---|---|
| `POST /api/tracking` | Ninguna | SQLi (C-1), XSS diferido vía IP/UA (C-10) |
| `GET /api/products/search` | Ninguna | SQLi (C-1) |
| `GET /api/files` | Ninguna | Path traversal, lectura de secretos (C-6) |
| `GET /api/flags`, `/api/flags/[slug]`, `/api/flags/progress` | Ninguna | Exposición de secretos (C-7) |
| `GET /api/documents/share` | Ninguna | Tokens forgeables, IDOR masivo (C-8) |
| `POST /api/support` | Ninguna | SSRF (C-11) |
| `GET /api/admin/diag` | Header hardcodeado | Secreto en código (C-13) |
| `POST /api/auth/signup` | Ninguna | Mass assignment de rol ADMIN (C-4) |
| `POST /api/auth/login` | Ninguna | MD5, password en logs, enumeración (C-5, C-15, M-2) |
| `POST /api/auth/forgot-password` | Ninguna | Token predecible (A-3), sin rate limit (A-4) |
| `GET /api/auth/support-login` | Token de soporte | Emite sesión de 365 días (A-8) |
| `GET /api/orders/[id]` | Sí | IDOR (A-1) |
| `GET /api/wishlists/[id]` | Sí | IDOR (A-1) |
| `POST /api/user/support-access` | Sí | Crear token de soporte para terceros (A-8) |
| `POST /api/user/export` | Sí | Fuga de flags/stacks en errores (A-5) |
| `POST /api/orders` | Sí | TOCTOU en cupones (A-6), IDs secuenciales (A-7) |
| `POST /api/orders/search` | Sí | SQLi (C-1) |
| `POST /api/ai-assistant` | Ninguna | SSRF MCP, prompt injection, exfil de flags (C-12) |
| `POST /api/mcp` | Header "secreto" público en código | `get_compliance_report` filtra flag (C-12/C-13) |
| `POST /api/monitoring/auth`, `GET /api/monitoring/logs` | root/admin hardcodeado | Credenciales débiles + logs con passwords (C-13/C-15) |
| `POST /api/admin/suppliers/import-order` | Admin | XXE (C-2) |
| `GET /api/admin/reviews` | Admin | SQLi vía `author` (C-1) |
| `POST /api/admin/products/[id]/image` | Admin | Permite SVG → XSS (C-17) |
| `/internal`, `/monitoring/internal-status` | Cabecera cliente / JWT sin firma | Bypass de "internal" (A-2) |

---

## 4. Secretos expuestos (rotar INMEDIATAMENTE)

Ubicación | Secreto |
|---|---|
| `.env.local` | `NEXT_PUBLIC_PAYMENT_SECRET="UUtCezcyMGYyYTc3MWU1MH0="` (base64 de texto plano; además público por `NEXT_PUBLIC_`), `FLAG_CVE_2025_55182="QKB{6b2cad3174c3}"` |
| `flag.txt`, `public/notice.txt` | `QKB{a77e424511f7}`, `QKB{0928ba72fab4}` (notice.txt se sirve en `/notice.txt`) |
| `supplier-registry.txt:4` | `api_key=QKB{9ed09177557e}` |
| `prisma/seed.ts` | 35+ valores `QKB{...}` sembrados en la tabla `flags` |
| `lib/server-auth.ts:12` | `JWT_SECRET` fallback `"secret"` |
| `lib/share-crypto.ts:6-10` | clave AES-256-CBC por defecto `a1b2c3...a1b2` |
| `app/api/monitoring/auth/route.ts:5-6`, `logs/route.ts:7-8` | `root` / `admin` |
| `app/api/admin/diag/route.ts:6` | `dbg_8f3a7c91e2b4d6a05e21` |
| `lib/mcp-constants.ts` | `X-MCP-Session: quokka-internal-agent` |
| `app/api/auth/login/route.ts:8`, `app/api/ai-assistant/route.ts:22` | códigos internos `QKB{5db6d39c813f}`, `QKB{282aa326914e}` |
| `app/admin/documents/page.tsx:5-6` | comentario interno filtrado al HTML |
| `logs/app.log` (generado) | contraseñas en texto plano (C-15) |

**Acción inmediata:** rotar todas las claves/tokens anteriores, purgar el historial de git de estos archivos, añadirlos a `.gitignore`/`.dockerignore`, y reconstruir la imagen Docker sin ellos.

---

## 5. Plan de remediación priorizado

1. **Hoy (P0):** actualizar `next` (CVE-2025-55182); rotar secretos (Sección 4); corregir SQLi de los 4 endpoints con queries parametrizadas; Añadir `..`-check y auth a `/api/files`; bloquear `/api/flags*`; exigir `JWT_SECRET` y eliminar fallback `"secret"`; quitar `role` del signup; cambiar MD5 por bcrypt/argon2; deshabilitar `noent/dtdload` en libxmljs.
2. **Esta semana (P1):** corregir XSS (innerHTML en reviews, `dangerouslySetInnerHTML` en analytics/soporte, SVG); SSRF en support y ai-assistant; IDOR en orders/wishlists; firma real en middleware y代替 de la cabecera `x-internal-request`; quitar log de passwords; AES-GCM + auth en share tokens; tokens aleatorios (gift cards/reset); rate limiting + CSRF; cabeceras de seguridad (CSP etc.).
3. **Este mes (P2):** hardening de Docker (imagen mínima, sin secretos), sesiones cortas + refresh, atomicidad en cupones, UUIDs, mensajes de error genéricos, `npm audit` en CI, WAF/monitorización, tests de seguridad automatizados (SAST/DAST), política de gestión de secretos y rotación.

---

## 6. Referencias

- OWASP Top 10 (2021): A01 Broken Access Control, A02 Cryptographic Failures, A03 Injection, A05 Security Misconfiguration, A07 Identification & Authentication Failures, A08 Software & Data Integrity Failures.
- CWE-89 (SQLi), CWE-22 (Path Traversal), CWE-79 (XSS), CWE-611 (XXE), CWE-798 (Hardcoded Credentials), CWE-916 (MD5), CWE-915 (Mass Assignment), CWE-639 (IDOR), CWE-918 (SSRF), CWE-352 (CSRF), CWE-330/340 (predictability), CWE-347 (improper signature verification), CWE-1104 (vulnerable dependency — CVE-2025-55182).

*Informe generado por auditoría estática de código. Se recomienda complementar con pruebas dinámicas (DAST) y un pentest antes de cualquier despliegue.*
