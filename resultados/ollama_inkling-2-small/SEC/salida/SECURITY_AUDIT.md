# Auditoría de Seguridad — Quokka Bazaar

- **Fecha:** 2026-11-23
- **Alcance:** código fuente completo del repositorio (Next.js 15.2.2 + Prisma + SQLite), configuración Docker, dependencias (`npm audit`), pipeline de build y configuración de entorno.
- **Metodología:** revisión estática manual del código (rutas API, middleware, librerías, cliente), análisis de configuración e inventario de dependencias. No se explotaron sistemas en ejecución ni se intentó acceso a datos reales; las conclusiones se basan en evidencia directa del código (archivo:línea).
- **Clasificación:** Confidencial — uso interno.
- **Nota sobre flags/secretos:** el repositorio contiene valores tipo `QKB{...}` en `prisma/seed.ts`, `.env.local`, `supplier-registry.txt` y constantes embebidas. Este informe **no reproduce** esos valores; indica su ubicación y recomienda rotarlos.

---

## 1. Resumen ejecutivo

La aplicación **no es apta para producción en su estado actual**. Se identificaron múltiples vulnerabilidades críticas que, encadenadas, permiten a un atacante sin autenticación previa: crear una cuenta de administrador, leer y modificar datos arbitrarios, exfiltrar secretos y tomar control total del backoffice. Los pilares que fallan son:

1. **Autenticación rota** (contraseñas MD5 sin sal, JWT con secreto por defecto `secret`, middleware que no verifica la firma, registro con auto‑asignación de rol `ADMIN`).
2. **Inyección SQL** en 4 endpoints vía `$queryRawUnsafe` / SQL concatenado.
3. **Autorización rota (IDOR / mass‑assignment)** en pedidos, wishlists, share tokens y `support-access`.
4. **Secretos embebidos en el código y en el repositorio** (`.env.local`, claves de API, clave de cifrado, toolchain de streaming).
5. **XSS almacenado** en 3 puntos renderizados con `dangerouslySetInnerHTML` / `innerHTML`.
6. **SSRF** en `/api/support` (fetch server-side de URL arbitraria con cabecera interna) y en `/api/ai-assistant` (`mcpServerUrl` controlado por el cliente).
7. **Exposición de datos sensibles**: contraseñas en logs de texto plano, endpoint de logs protegido con credenciales por defecto (`root`/`admin`), y `.env.local` copiado dentro de la imagen Docker.

| Severidad | Nº |
|---|---|
| Crítica | 9 |
| Alta | 10 |
| Media | 8 |
| Baja / Informativa | 6 |

---

## 2. Hallazgos críticos

### C-01. Registro permite auto-asignarse rol `ADMIN` (mass assignment)
- **Evidencia:** `app/api/auth/signup/route.ts` (≈ líneas 52–83): el body pasa por `signupBodySchema` con `.passthrough()` y `role: z.string().optional()`; el rol se copia tal cual a la creación del usuario (`userData.role = body.role as UserRole`).
- **Impacto:** cualquier visitante anónimo puede registrarse como `ADMIN` y acceder a todo el panel y a las APIs administrativas.
- **Remediación:** ignorar `role` del cliente; asignar `CUSTOMER` siempre. Validar el enum con zod (`z.enum([...])`) y eliminar `.passthrough()`.

### C-02. Hash de contraseñas MD5 sin sal
- **Evidencia:** `lib/server-auth.ts` (`hashMD5`, usada en login, signup, reset-password).
- **Impacto:** las contraseñas son recuperables por fuerza bruta/rainbow tables ante cualquier fuga de la BD (la BD SQLite ya está en el repo de despliegue vía Docker).
- **Remediación:** migrar a Argon2id o bcrypt (coste ≥ 12) o scrypt; plan de migración re‑hasheando en el próximo login.

### C-03. JWT con secreto por defecto y verificación ausente en middleware
- **Evidencia:** `lib/server-auth.ts:12` — `process.env.JWT_SECRET || "secret"`. `middleware.ts` decodifica el payload con `atob` **sin verificar la firma** y confía en `payload.role` para `/monitoring/internal-status`.
- **Impacto:** un atacante puede forjar un token con `role: "ADMIN"` y contenido arbitrario; el middleware lo acepta. Si `JWT_SECRET` no se define, cualquiera puede firmar tokens admin válidos para toda la app.
- **Remediación:** exigir `JWT_SECRET` fuerte (≥ 32 bytes aleatorios) y fallar el arranque si falta; verificar la firma en el middleware o eliminar la duplicación y delegar en `withAdminAuth`; rotar el secreto actual.

### C-04. Token de reseteo de contraseña predecible
- **Evidencia:** `app/api/auth/forgot-password/route.ts` — `token = md5(email + timestamp)`; el endpoint **devuelve `requestedAt`** (ISO) en la respuesta, y `timestamp` es `Math.floor(now/1000)`.
- **Impacto:** un atacante puede solicitar un reseteo para una víctima y derivar el token probando unos pocos segundos alrededor de `requestedAt` → toma de cuenta completa.
- **Remediación:** tokens aleatorios criptográficos (`crypto.randomBytes(32)`), almacenados hasheados, de un solo uso, con expiración corta; nunca devolver metadatos temporales que permitan derivarlo.

### C-05. Inyección SQL en búsqueda de productos
- **Evidencia:** `app/api/products/search/route.ts` — `prisma.$queryRawUnsafe(\`... LIKE '%${query}%' ...\`)` con `q` directo del usuario.
- **Impacto:** lectura completa de la base de datos (UNION-based), incluidos usuarios y hashes de contraseña.
- **Remediación:** usar Prisma `contains`/`mode: 'insensitive'` o parámetros enlazados (`$queryRaw` con tagged templates); nunca interpolar entrada del usuario.

### C-06. Inyección SQL en búsqueda de pedidos
- **Evidencia:** `app/api/orders/search/route.ts` — `status` interpolado directamente en `WHERE o.status = '${status}'` vía `$queryRawUnsafe`.
- **Impacto:** inyectar SQL autenticado para exfiltrar/modificar datos (`status = "x' OR '1'='1"`, UNION, etc.). El filtro que oculta cadenas `qkb{` en la salida no es un control de seguridad.
- **Remediación:** parametrizar; validar `status` contra lista blanca (ya existe la validación de enum para PATCH; aplicarla también aquí) o usar Prisma tipado.

### C-07. Inyección SQL vía cabecera `X-Forwarded-For` (tracking)
- **Evidencia:** `app/api/tracking/route.ts` — `ip` (de `x-forwarded-for`) e `sessionId` se interpolan sin escapar en un `INSERT` raw; `userAgent` y `path` sí se escapan (doble `''`), lo que demuestra el conocimiento pero deja huecos.
- **Impacto:** atacante anónimo inyecta SQL arbitrario en cada request; además de exfiltración, puede hacer que el panel de analítica almacene payloads (ver A-02, XSS almacenado vía IP).
- **Remediación:** usar Prisma `create` en vez de raw SQL; si se usa raw, usar parámetros enlazados y eliminar `x-forwarded-for` como fuente de verdad (o normalizarlo).

### C-08. Exposición de ficheros arbitrarios en `/api/files`
- **Evidencia:** `app/api/files/route.ts` — sin autenticación; `join(baseDir, file)` con `file` arbitrario (`?file=../../.env.local`, `?list=true&path=../../`). `path.join` normaliza y permite escapar de `documents/`.
- **Impacto:** lectura de cualquier fichero legible por el proceso: `.env.local`, claves, `prisma/dev.db`, código fuente, `logs/app.log`.
- **Remediación:** exigir autenticación+autorización, resolver la ruta y verificar `path.resolve(baseDir, file).startsWith(baseDir + sep)`, o servir desde un índice de IDs en lugar de rutas.

### C-09. `support-access` permite suplantar a cualquier usuario (escalada a admin)
- **Evidencia:** `app/api/user/support-access/route.ts` POST — acepta `{ email }` arbitrario; crea un `SupportAccessToken` para **ese** usuario y devuelve `supportLoginUrl`. Luego `GET /api/auth/support-login` emite una sesión con el rol del suplantado (incl. `ADMIN`) y `supportAccess: true`.
- **Impacto:** cualquier usuario autenticado obtiene sesión de administrador (o de cualquier cuenta) en 2 llamadas. Crítico.
- **Remediación:** eliminar el parámetro `email` (solo el propio usuario puede pedir soporte) o exigir rol admin; tokens de un solo uso, expiración corta, vinculados a IP/propósito, y notificación al usuario afectado.

---

## 3. Hallazgos altos

### A-01. IDOR en detalle de pedido (`/api/orders/[id]`)
- **Evidencia:** `app/api/orders/[id]/route.ts` GET — cualquier usuario autenticado lee cualquier pedido: dirección completa, email y nombre del cliente. No hay comprobación `order.userId === user.id` ni rol admin.
- **Remediación:** verificación de propiedad o rol admin; devolver 404/403 en caso contrario.

### A-02. XSS almacenado vía IP en panel de analítica
- **Evidencia:** `app/admin/analytics/AnalyticsClient.tsx` renderiza `visit.ip` con `dangerouslySetInnerHTML`. La IP proviene de `x-forwarded-for` (controlada por el cliente, ver C-07) y se guarda en `visitor_logs`.
- **Impacto:** script ejecutado en el navegador del admin al abrir Analítica → robo de sesión admin.
- **Remediación:** renderizar como texto; nunca `dangerouslySetInnerHTML` con datos persistidos; validar/normalizar la IP en el servidor.

### A-03. XSS almacenado en reseñas de producto
- **Evidencia:** `app/products/[id]/ProductDetailClient.tsx` (líneas ≈50–60) — `reviewElement.innerHTML = review.content` y re-creación manual de `<script>`. El contenido proviene de `POST /api/products/[id]/reviews` (sin sanitizar; `author` también libre).
- **Impacto:** cualquier visitante planta JS persistente ejecutado para todos los visitantes del producto (robo de sesión, skimming).
- **Remediación:** renderizar texto plano o Markdown sanitizado (DOMPurify); eliminar la lógica de re-ejecución de scripts; validar longitud/formato en el servidor.

### A-04. SSRF en `/api/support` con cabecera interna
- **Evidencia:** `app/api/support/route.ts` — hace `fetch(screenshotUrl)` con `X-Internal-Request: true` y devuelve el cuerpo (`screenshotContent`) en la respuesta. Sin allowlist de esquemas/hosts, sin bloqueo de rangos internos.
- **Impacto:** el atacante lee servicios internos (metadata cloud `169.254.169.254`, `/internal`, admin de otros hosts) y ve el contenido reflejado. La cabecera interna además "autentica" frente a `/internal/*` que confían en `x-internal-request: true` (ver A-05).
- **Remediación:** allowlist de dominios https, resolución DNS con bloqueo de rangos privados/loopback, no devolver el cuerpo crudo (solo metadatos), timeout y límite de tamaño.

### A-05. `/internal` confiable por cabecera falsificable
- **Evidencia:** `app/internal/page.tsx` confía en `headers().get("x-internal-request") === "true"`. Cualquier cliente puede enviar esa cabecera. Igual patrón en `/internal/oauth/callback` y en `/api/support` (envío de la cabecera).
- **Impacto:** bypass del supuesto control de acceso al "panel interno"; cadena SSRF → cabecera interna → acceso a internals.
- **Remediación:** eliminar el chequeo por cabecera; usar autenticación real (sesión admin) o mTLS/network policy; nunca confiar en cabeceras del cliente sin firma.

### A-06. Logs con contraseñas en claro + SIEM con credenciales por defecto
- **Evidencia:** `app/api/auth/login/route.ts` loguea `password` y un tag en `logger.warn(...)`; `instrumentation.node.ts` y `lib/logger.ts` vuelcan todo a `logs/app.log`. `app/api/monitoring/logs/route.ts` protege ese log con usuario/contraseña **hardcodeados** `root`/`admin` (y cookie `siem_session=authenticated` forjable). `/api/monitoring/auth` tiene el mismo par.
- **Impacto:** cualquiera que alcance `/api/monitoring/logs` (con credenciales públicas en el código) lee las contraseñas de todos los usuarios que iniciaron sesión. Toma de cuenta masiva.
- **Remediación:** no loguear secretos nunca; eliminar credenciales por defecto; autenticación real en monitoring (SSO/mTLS), cookie aleatoria por sesión, rate limiting; purgar/rotar `logs/app.log`.

### A-07. Precio del pedido controlado por el cliente
- **Evidencia:** `app/api/orders/route.ts` POST — `total` viene del body (`createOrderBodySchema` solo exige `number().positive()`); nunca se recalcula desde el carrito.
- **Impacto:** pedidos por 0.01 € con valor real; pérdida económica directa.
- **Remediación:** calcular el total en el servidor desde `cartItems × product.price`; ignorar el total del cliente; validar cupones y stock en servidor dentro de una transacción.

### A-08. Divulgación de hash de contraseña y diagnósticos internos en `/api/user/export`
- **Evidencia:** `ALLOWED_USER_FIELDS` incluye `"password"` (el propio usuario exporta su hash MD5 → crackeable offline). En rutas de error, la respuesta incluye `systemDiagnostics` con versión de Node, `NODE_ENV`, estado de BD, y un valor de `featureFlags` leído de la tabla `flag`; además `error.stack`/mensaje en 500.
- **Impacto:** fuga de información interna y de secretos/flags de la BD; facilita ataques posteriores.
- **Remediación:** eliminar `password` de los campos exportables; nunca incluir excepciones ni diagnósticos en respuestas; errores genéricos + logging interno.

### A-09. XSS/contenido remoto en flujo de soporte (Screenshot) encadenado con SSRF
- **Evidencia:** `app/support/SupportForm.tsx` — `submittedData.screenshotContent` se inyecta con `dangerouslySetInnerHTML`. Combinado con A-04, un atacante hace que la app renderice HTML remoto arbitrario en el navegador de la víctima/operador.
- **Remediación:** no renderizar HTML remoto; mostrar como texto o sanitizar con DOMPurify; en general, prohibir `dangerouslySetInnerHTML` sin sanitización.

### A-10. Cifrado de tokens de compartición rompible/falsificable
- **Evidencia:** `lib/share-crypto.ts` — AES-256-**CBC** sin MAC (malleable) y clave por defecto hardcodeada (`SHARE_ENCRYPTION_KEY || "a1b2..."`, hex de 64 chars en el código). `/api/documents/share` descifra el token sin autenticación y devuelve el recurso (`order:<id>` o `report:internal`).
- **Impacto:** forja o manipulación de tokens para leer pedidos ajenos (`order:<id>`) o el "Internal Security Audit Report" (`report:internal`). Sin expiración ni revocación.
- **Remediación:** AES-256-GCM con clave obligatoria por entorno; tokens aleatorios opacos guardados hasheados en BD con expiración y revocación; control de acceso por propiedad.

---

## 4. Hallazgos medios

### M-01. XSS almacenado en recorridos del admin (IP) — ver A-02; y `admin/documents` incluye un HTML oculto estático
`app/admin/documents/page.tsx` inyecta `DEV_NOTE_HTML` en un `<div hidden dangerouslySetInnerHTML>`. Hoy es estático, pero es un patrón peligroso y además filtra comentarios internos de desarrollo. Eliminarlo.

### M-02. Credenciales y secretos hardcodeados en el código
- `lib/live-stream.ts`: RTMP URL y `streamKey` de producción.
- `app/api/admin/diag/route.ts`: token `x-debug-auth` y `DIAG_BUILD_ID` en código.
- `lib/mcp-constants.ts`: `X-MCP-Session: quokka-internal-agent` — credencial de "herramienta interna" embebida en el repo (backend-only, pero versionada).
- `app/api/monitoring/*`: `root`/`admin`.
- **Remediación:** mover todo a variables de entorno/secret manager; rotar; escanear con gitleaks/trufflehog en CI.

### M-03. `.env.local` y `supplier-registry.txt` en el repositorio; `NEXT_PUBLIC_PAYMENT_SECRET` expuesto al cliente
- `.env.local` contiene `NEXT_PUBLIC_PAYMENT_SECRET` y una variable `FLAG_CVE_2025_55182`. `.dockerignore` excluye `.env` **pero no `.env.local`** → el archivo se copia dentro de la imagen Docker (`COPY . .`).
- `NEXT_PUBLIC_*` se incrusta en el bundle del navegador (`app/checkout/CheckoutClient.tsx` la lee): un "secreto" público.
- `supplier-registry.txt` contiene una `api_key` en texto plano.
- **Remediación:** eliminar del repo, rotar todas las claves, añadir `.env*` a `.dockerignore`/`.gitignore`, usar build secrets.

### M-04. Confianza en entradas para cabeceras del cliente
- `app/api/orders/[id]/share/route.ts` construye `shareUrl` con `x-forwarded-host`/`host` (host header injection → enlaces de phishing con el dominio del atacante).
- `app/api/tracking/route.ts` confía en `x-forwarded-for`.
- **Remediación:** usar `NEXT_PUBLIC_BASE_URL`/`Host` validado; ignorar cabeceras del cliente salvo proxy confiable con `trust proxy` configurado explícitamente.

### M-05. Orden de IDs predecibles y enumeración
`ORD-001…` secuenciales (`app/api/orders/route.ts`). Facilita enumeración de pedidos combinado con A-01/A-10. Usar IDs no secuenciales (cuid/UUID ya usado en resto del modelo) y autorización por propiedad.

### M-06. Códigos de gift card predecibles
`lib/gift-card.ts` — LCG (`Math.imul(state, 1103515245) + 12345`) sembrado con `Date.now()` (milisegundos). Conocida la fecha aproximada de compra, el espacio de búsqueda es pequeño; el redeem itera todas las tarjetas PENDING, lo que facilita la validación de candidatos.
- **Remediación:** `crypto.randomInt`/`randomBytes`, 128 bits de entropía, y búsqueda por índice único (no escaneo de todas las pendientes).

### M-07. Condición de carrera en cupones y lógica de checkout
`app/api/orders/route.ts`: incremento de `usedCount` tras comprobar `usedCount < maxUses` con `setTimeout(150ms)` "de amortiguación" — TOCTOU clásico; permite superar `maxUses` con peticiones concurrentes. Además el descuento no se aplica al total (el cliente envía `total`, ver A-07).
- **Remediación:** `UPDATE ... WHERE usedCount < maxUses` atómico (updateMany con where) en transacción; recalcular total en servidor.

### M-08. Prompt injection / abuso de herramienta MCP en el asistente IA
`app/api/ai-assistant/route.ts` + `/api/mcp`:
- El filtro (`lib/prompt-injection-filter.ts`) son 4 regex; burla trivial con unicode/sinónimos.
- El usuario puede pasar `mcpServerUrl` → el servidor hace JSON-RPC a esa URL con las herramientas y **reenvía resultados** al LLM; exfiltración indirecta y SSRF (ver también A-04).
- `get_compliance_report` "protegida" solo por la cabecera constante `X-MCP-Session` del M-02; cualquiera con el repo la tiene.
- **Remediación:** no aceptar `mcpServerUrl` del cliente (o allowlist estricta); autenticar el conector MCP; defensa en profundidad real (confirmación humana para herramientas sensibles, límites de tasa, allowlist de herramientas por sesión).

### M-09. Enumeración de usuarios y respuestas distintas en login
`app/api/auth/login/route.ts` devuelve `Invalid credentials` vs `Invalid password` (usuario inexistente vs contraseña errónea) y `signup` devuelve 409 si el email existe. Facilita enumeración para password-spraying (sin rate limiting).
- **Remediación:** mensaje único, mismo tiempo de respuesta (hash dummy), rate limiting por IP/email, captcha tras N fallos.

### M-10. Contraseñas y tokens de soporte sin expiración efectiva
`support-login` emite sesiones de **1 año** (`exp: now + 365d`) y los `SupportAccessToken` duran 365 días; `DELETE /api/user/support-access` solo revoca los del propio usuario. Además el token viaja en query param (`?token=`) → queda en logs/historial/referer.
- **Remediación:** expiración corta (minutos/horas), un solo uso, envío por POST/body, revocación al usarse, no en URL.

---

## 5. Hallazgos bajos / informativos

- **B-01. Dependencias con vulnerabilidades conocidas.** `next@15.2.2` tiene CVEs públicos de bypass de middleware (CVE-2025-29927, corregido en 15.2.3+) y la serie React Server Components tiene el CVE-2025-55182 (React2Shell); `npm audit` reporta además `brace-expansion`, `glob`, `deepmerge-ts`, `effect` (DoS/ReDoS). Actualizar Next/React/prisma/libxmljs2 y re-auditar. `eslint-config-next` 16 vs Next 15 inconsistente.
- **B-02. `JsonWebToken`/cookie sin banderas completas.** Cookie `authToken` sin `__Host-` prefix; `secure` solo en producción (correcto), pero sin `maxAge` coherente con rotación; SameSite=Lax es aceptable pero documentar. No hay CSRF token (aceptar solo SameSite=Strict para rutas sensibles o añadir token).
- **B-03. Sin cabeceras de seguridad** en `next.config.ts` (CSP, X-Frame-Options/frame-ancestors, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). `images.remotePatterns` permite cualquier ruta de dos hosts (aceptable) — revisar.
- **B-04. `Dockerfile` ejecuta como root**, sin multi-stage, sin `HEALTHCHECK`, `npm ci` con devDependencies en la imagen final; `docker-compose.yml` no fija versiones de imagen ni límites de recursos; `setup.sh` lanza `prisma studio` en `0.0.0.0:5555` sin autenticación.
- **B-05. `package.json` con `"private": false`** y sin `files` — riesgo de publicación accidental en npm con el código fuente y secretos.
- **B-06. Manejo de errores inconsistente:** varios catch devuelven 200/4xx con detalles internos; `/api/orders/search` relanza el error de la query cruda al manejador global. Respuestas de error deberían ser uniformes y sin detalles internos.
- **B-07. CSV injection** en `/api/user/export` (valores que empiezan por `=`, `+`, `-`, `@` no se neutralizan) — riesgo al abrir el CSV en Excel.
- **B-08. `upload` de imágenes** (`/api/admin/products/[id]/image`): permite `image/svg+xml` → SVG con script servido desde `/api/uploads/...` con `Content-Type: image/svg+xml` → XSS almacenado en el origen. Además `filename` deriva del nombre del cliente (mitigado parcialmente) y no se valida el contenido real del fichero (solo `file.type` declarado). Revisar/normalizar SVG o rasterizar.
- **B-09. `wishlist` público sin control de acceso:** `GET /api/wishlists/[id]` no verifica `userId` ni `isPublic`; devuelve email del propietario y contenido a cualquier usuario autenticado (IDOR).
- **B-10. `flags` expuesto públicamente:** `GET /api/flags` y `/api/flags/[slug]` devuelven las filas completas (incluido el campo del reto) sin autenticación.
- **B-11. `middleware.ts` duplica lógica de auth** sin verificar firma (ver C-03) y solo protege `/monitoring/internal-status`; el resto confía en cada ruta (frágil).
- **B-12. Reutilización de `crypto` inseguro en `gift-cards/redeem`** está bien (comparación en tiempo constante) — positivo; pero la búsqueda es O(n) sobre todas las PENDING.
- **B-13. Logs y evidencias:** `instrumentation.node.ts` escribe `logs/app.log` sin rotación → crecimiento indefinido y exposición de PII; `.gitignore` ignora `logs/` (bien) pero el archivo puede existir en despliegues.
- **B-14. `docker-compose.yml`** monta `env_file: .env.local` completo dentro del contenedor — innecesario y peligroso; pasar solo las variables requeridas.
- **B-15. `next` con `typescript`/`eslint` ignorados?** — verificar que `next build` no ignora errores de tipo/lint en producción (no hay `ignoreBuildErrors`, correcto).

---

## 6. Controles que sí están bien

- Uso sistemático de Zod en la mayoría de endpoints (validación de body/query/form).
- `withAuth`/`withAdminAuth` centralizados en `lib/server-auth.ts` y aplicados en casi todas las rutas sensibles.
- Comparación en tiempo constante en `redeem` de gift cards y revocación idempotente.
- `escape` correcto en la mayoría de consultas Prisma (ORM), con excepciones puntuales (C-05/06/07).
- Cookies de sesión `HttpOnly`, `SameSite=Lax`, `path=/`.
- `.gitignore` cubre `.env`, `logs/`, `prisma/*.db`.
- `parseFloat`/límites razonables en algunos puntos (tamaño de upload 5 MB, `max_tokens`, límites de logs `limit ≤ 200`).
- Cabecera `Cache-Control` razonable en uploads; nombres de fichero saneados en `/api/admin/products/[id]/image`.

---

## 7. Cadenas de ataque ilustrativas (sin explotar)

1. **Anónimo → ADMIN → control total:** `POST /api/auth/signup {email, password, role:"ADMIN"}` → sesión admin → `/api/admin/*` (importación XML con XXE en `/api/admin/suppliers/import-order` con `noent:true, dtdload:true` → lectura de `/etc/passwd` si el parseo de entidades falla ruidosamente, SSRF/errores con rutas), acceso a analytics/reviews.
2. **Anónimo → cuenta ajena:** `/login?redirect=` → open redirect (B/M) + `POST /api/auth/forgot-password` → `requestedAt` devuelto → `md5(email+ts)` → `/api/auth/reset-password`.
3. **XSS → robo de sesión admin → panel:** reseña con `<script>` → `/products/[id]` → cookie `authToken` (no es accesible por JS por ser HttpOnly, pero el atacante puede actuar como admin vía fetch same-origin: crear admin, cambiar estado de pedidos, robar contenido).
4. **SSRF → cabecera interna:** `POST /api/support {screenshotUrl:"http://169.254.169.254/latest/meta-data/..."}` → respuesta incluida en `screenshotContent` → además renderizada con `dangerouslySetInnerHTML`.

---

## 8. Prioridades de remediación

**Inmediato (esta semana):**
1. Rotar **todos** los secretos (JWT_SECRET, claves Mistral/supplier/share/diag, credenciales SIEM), sacar `.env.local` y `supplier-registry.txt` del control de versiones, depurar imágenes Docker.
2. Eliminar `role` del alta de usuarios; Argon2/bcrypt; `JWT_SECRET` obligatorio y firma verificada también en middleware.
3. Eliminar `$queryRawUnsafe` → Prisma parametrizado; parametrizar `tracking`, `orders/search`, `products/search`, `admin/reviews`.
4. Auth obligatorio + path containment en `/api/files`; allowlist + bloqueo de red interna en `/api/support` y `/api/ai-assistant`; eliminar `x-internal-request` como mecanismo de acceso a `/internal`.
5. No loguear contraseñas; borrar `logs/app.log`; eliminar credenciales por defecto del SIEM.

**Corto plazo (2 semanas):**
6. Corregir los 3 XSS (reviews, analytics IP, soporte) y eliminar `dangerouslySetInnerHTML`/`innerHTML` no sanitizado.
7. IDOR: ownership check en pedidos, wishlists, shares; tokens de compartir opacos con expiración (AES-GCM + storage server-side).
8. Total del pedido calculado en servidor; transacción atómica para cupón + pedido.
9. Token de reseteo aleatorio e irrepetible; eliminar `requestedAt` de la respuesta.
10. Actualizar Next/React/Prisma/libxmljs2; `npm audit fix`; fijar lockfile; CI con `npm audit` y gitleaks.

**Medio plazo:**
11. Cabeceras de seguridad + CSP/nonce; rate limiting global (p. ej. middleware/edge); CSRF en rutas que mutan; cookie `__Host-`.
12. Dockerfile multi-stage, usuario no-root, `HEALTHCHECK`, secrets vía BuildKit; quitar `prisma studio` del arranque; compose sin `.env.local` completo.
13. Programa de logging/monitoreo real (alerta por login fallido, cambios de rol, uso de support-access), rotación de logs, sin PII.
14. Tests de seguridad en CI (SAST + ZAP baseline + tests de autorización por ruta) y política de revisión de dependencias.

---

## 9. Anexo — Inventario de superficies revisadas
- Rutas API: 57 ficheros bajo `app/api/**` (auth, admin, orders, products, products/search, cart, wishlists, gift-cards, documents, files, uploads, monitoring, mcp, ai-assistant, user, tracking, flags, …).
- Páginas cliente con sinks DOM: `ProductDetailClient.tsx`, `AnalyticsClient.tsx`, `SupportForm.tsx`, `admin/documents/page.tsx`.
- Config: `middleware.ts`, `next.config.ts`, `instrumentation*.ts`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.gitignore`, `package.json`, `prisma/schema.prisma`, `lib/*` (auth, crypto, db, logger, validation).
- Dependencias: `npm audit` (ver B-01).

*Fin del informe.*
