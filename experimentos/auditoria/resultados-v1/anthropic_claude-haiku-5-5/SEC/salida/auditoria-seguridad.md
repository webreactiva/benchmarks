# Auditoría de seguridad — Quokka Bazaar (v2.17.0)

**Fecha:** 2026-11-23
**Alcance:** revisión estática del código fuente (`app/`, `lib/`, `middleware.ts`, `prisma/`, `Dockerfile`, `docker-compose.yml`, configuración y ficheros en la raíz) y análisis de dependencias con `npm audit` sobre `package-lock.json`.
**Método:** lectura de todas las rutas de API y de las rutas de control de acceso, búsqueda de sinks peligrosos (SQL crudo, `dangerouslySetInnerHTML`, `fetch` con URL del usuario, `fs` con rutas del usuario, XML), y revisión de secretos y configuración de despliegue.
**Limitaciones:** no se ejecutó la aplicación ni se lanzaron exploits contra ella. Cada hallazgo se basa en la lectura del código; las rutas de explotación descritas son las que se deducen de ese código y deben confirmarse en un entorno de pruebas antes de corregir. Las versiones de dependencias vulnerables provienen de `npm audit` (requiere red para consultar la base de advisories).

> **Contexto.** El proyecto parece ser un laboratorio de formación deliberadamente vulnerable: contiene valores con formato `QKB{...}` (retos/flags), comentarios del tipo *"The secure version uses…"* y un mensaje de "Enjoying the lab?" en el entrypoint de Docker. Esto explica muchos hallazgos, pero el código es real y, si la aplicación se expone fuera de un entorno aislado, cada punto de abajo es explotable. Los valores de flags y secretos se muestran parcialmente redactados en este informe.

---

## 1. Resumen ejecutivo

| Severidad | Nº | Ejemplos principales |
|---|---|---|
| **Crítica** | 11 | Forjado de sesión admin (JWT sin verificar / secreto por defecto), registro como ADMIN, takeover de cuentas por reset predecible, lectura arbitraria de ficheros sin autenticación, SQL injection sin autenticación, SSRF sin autenticación, bypass del SIEM, Next.js con CVEs críticos |
| **Alta** | 12 | XSS almacenado en analytics, IDOR en pedidos y wishlists, tokens de compartición falsificables, precio de pedido controlado por el cliente, XXE, secretos en repositorio e imagen Docker, contenedor como root |
| **Media** | 12 | MD5 sin sal, sin rate limiting, sin cabeceras de seguridad, sesiones sin revocación, XSS en bio, códigos de regalo predecibles |
| **Baja** | 4 | Cabeceras/detalles de error, redirect sin validar, reseñas con autor suplantable |

**Lo más urgente:** un atacante sin cuenta puede leer `.env.local` y la base de datos mediante `/api/files`, inyectar SQL en `/api/products/search`, y convertirse en administrador con varios caminos independientes (forjar la cookie, registrarse con `role: "ADMIN"`, o resetear contraseñas de cualquier cuenta).

---

## 2. Hallazgos críticos

### C-01 · El middleware no verifica la firma del JWT (acceso admin falsificable)
- **Ubicación:** `middleware.ts:3-31`
- **Descripción:** `decodeJWT` solo decodifica el payload en base64 y comprueba `exp`; nunca valida la firma HMAC. Cualquiera puede fabricar una cookie `authToken` con `"role":"ADMIN"` y el middleware la acepta.
- **Impacto:** acceso a `/monitoring/internal-status` y cualquier otra ruta protegida solo por este middleware.
- **Corrección:** usar la misma verificación que `lib/server-auth.ts` (`decodeSessionToken`) o `jose`/`jsonwebtoken` con verificación de firma, y validar en el servidor, no solo en el middleware.

### C-02 · Secreto de firma JWT por defecto (`"secret"`)
- **Ubicación:** `lib/server-auth.ts:12`; `JWT_SECRET` no aparece en `docker-compose.yml`, `.env.local` ni en el Dockerfile.
- **Descripción:** si `JWT_SECRET` no está definido, la firma usa la cadena `"secret"`, pública en el repositorio. Con ella se pueden firmar sesiones válidas para cualquier `id` y `role`, y `withAuth` / `withAdminAuth` las aceptan.
- **Impacto:** suplantación de cualquier usuario, incluido ADMIN, en toda la API.
- **Corrección:** fallar al arrancar si `JWT_SECRET` falta o es débil; generar un secreto aleatorio de ≥ 32 bytes.

### C-03 · Registro con rol arbitrario (mass assignment → ADMIN)
- **Ubicación:** `app/api/auth/signup/route.ts:52-60`; `lib/validation/schemas/auth.ts` (`signupBodySchema` con `.passthrough()` y `role: z.string().optional()`).
- **Descripción:** el cliente puede enviar `"role": "ADMIN"` en el registro y el servidor lo asigna directamente.
- **Impacto:** cualquiera puede crear una cuenta administradora.
- **Corrección:** eliminar `role` del esquema de registro; el rol debe asignarlo solo el servidor. Quitar `.passthrough()`.

### C-04 · IDOR en tokens de acceso de soporte: escalada a ADMIN y tokens no revocables
- **Ubicación:** `app/api/user/support-access/route.ts:58-61` (POST), `app/api/auth/support-login/route.ts` (no comprueba `revoked`), `app/api/admin/support-audit/route.ts`.
- **Descripción:**
  1. `POST /api/user/support-access` acepta `{"email": "<cualquiera>"}` y crea un token de 365 días para **cualquier** usuario, incluido `admin@oss.com`, sin comprobar que el solicitante sea ese usuario ni que tenga permisos.
  2. `GET /api/auth/support-login?token=…` concede sesión con `supportAccess: true` y el rol del usuario objetivo, pero **no comprueba `supportToken.revoked`**, así que `DELETE /api/user/support-access` no revoca nada en la práctica.
- **Impacto:** cualquier usuario registrado obtiene una sesión de administrador persistente durante un año y no puede ser revocada.
- **Corrección:** derivar el usuario del token de sesión (no del body), restringir la creación a soporte autorizado, comprobar `revoked` y `expiresAt` en el login, y registrar la emisión y el uso.

### C-05 · Reset de contraseña con token predecible (toma de cuenta)
- **Ubicación:** `app/api/auth/forgot-password/route.ts:14, 22, 42`; `app/api/auth/reset-password/route.ts`.
- **Descripción:** el token de reset es `md5(email + timestamp_en_segundos)`. La propia respuesta devuelve `requestedAt` (ISO con segundos), así que el atacante conoce el timestamp y puede calcular el token para cualquier email con un único POST.
- **Impacto:** toma de control de cualquier cuenta conociendo solo el email de la víctima.
- **Corrección:** tokens de `crypto.randomBytes(32)` guardados como hash (SHA-256), caducidad corta, un solo uso, y envío por correo (nunca en la respuesta). No devolver timestamps.

### C-06 · SQL injection sin autenticación (`/api/products/search` y `/api/tracking`)
- **Ubicación:**
  - `app/api/products/search/route.ts:93, 100` — `q` se interpola en `$queryRawUnsafe`.
  - `app/api/tracking/route.ts` — el `INSERT` con `$queryRawUnsafe` interpola `X-Forwarded-For` (`ip`) y `sessionId` **sin escapar** (solo se escapan comillas en `userAgent` y `path`).
- **Descripción:** ambas rutas son públicas. La "protección" es una lista de palabras clave (`UNION`, `SELECT`, `--`…), que no es una defensa válida.
- **Impacto:** lectura de cualquier tabla (usuarios con hashes MD5, pedidos, direcciones) y, según el driver, modificación de datos.
- **Corrección:** usar consultas parametrizadas (`$queryRaw` con plantilla etiquetada o `Prisma.sql`) o el query builder de Prisma; eliminar los filtros por palabras clave como medida de seguridad.

### C-07 · SQL injection autenticada en `/api/orders/search`
- **Ubicación:** `app/api/orders/search/route.ts:81, 96, 102` — `status` se interpola en `statusFilter` y en la consulta completa.
- **Descripción:** cualquier usuario registrado (el registro está abierto, ver C-03) puede inyectar SQL. Como `$queryRawUnsafe` ejecuta la consulta con el mismo acceso a la base de datos, la inyección permite leer toda la base de datos, no solo los pedidos del usuario.
- **Corrección:** igual que C-06.

### C-08 · Lectura arbitraria de ficheros y listado de directorios sin autenticación
- **Ubicación:** `app/api/files/route.ts:13, 20, 49`.
- **Descripción:** el endpoint no tiene ninguna comprobación de sesión. `file` y `path` se unen con `join(baseDir, …)` sin validar que el resultado quede dentro de `documents/`. Con `file=../../.env.local` o `file=../../prisma/dev.db` se leen ficheros fuera del directorio. `list=true&path=../..` lista directorios.
- **Impacto:** exposición de secretos (`.env.local`, `supplier-registry.txt`), código fuente, la base de datos SQLite completa (hashes de contraseñas, tokens) y variables de entorno (`/proc/self/environ`).
- **Corrección:** exigir autenticación, resolver la ruta con `path.resolve` y comprobar que empieza por `baseDir + path.sep`, y/o usar una lista blanca de ficheros.

### C-09 · SSRF sin autenticación con reflejo de la respuesta
- **Ubicación:** `app/api/support/route.ts:16-24`; `app/support/SupportForm.tsx:103`.
- **Descripción:** el endpoint es público y hace `fetch(screenshotUrl)` con cualquier URL, añadiendo `X-Internal-Request: true`. El cuerpo completo de la respuesta se devuelve y se renderiza con `dangerouslySetInnerHTML`.
- **Impacto:** acceso a servicios internos (`http://127.0.0.1:3000/api/...`, metadatos de cloud, redes privadas) y lectura de su contenido; además XSS reflejado con el origen de la aplicación.
- **Corrección:** lista blanca de hosts o eliminar la funcionalidad; bloquear rangos privados y loopback tras resolver DNS; no renderizar HTML remoto; no devolver el cuerpo al cliente.

### C-10 · SIEM/monitorización con credenciales hardcodeadas, cookie constante y contraseñas en logs
- **Ubicación:** `app/api/monitoring/auth/route.ts:5, 16`; `app/api/monitoring/logs/route.ts:7, 20-27`; `app/api/auth/login/route.ts:16-24`; `instrumentation.node.ts`; `lib/logger.ts`.
- **Descripción:**
  - Credenciales fijas `root` / `admin`.
  - La cookie `siem_session` tiene el valor constante `authenticated`; cualquiera puede enviarla a mano.
  - `/api/auth/login` escribe la **contraseña en texto claro** en `logs/app.log` (`logger.warn` con `password`), y también el email y un flag.
  - `/api/monitoring/logs` devuelve el log completo, así que cualquiera que pase la cookie o las credenciales obtiene todas las contraseñas introducidas en login.
- **Impacto:** robo masivo de credenciales en claro.
- **Corrección:** eliminar la contraseña de los logs (y de cualquier log), eliminar credenciales fijas, usar sesiones firmadas con expiración y MFA si procede; no exponer logs crudos por HTTP.

### C-11 · Dependencias con CVEs críticos (Next.js 15.2.2)
- **Ubicación:** `package.json` (`"next": "15.2.2"`), `package-lock.json` (`node_modules/next` 15.2.2).
- **Descripción:** `npm audit` reporta 53 vulnerabilidades (3 críticas, 21 altas, 27 moderadas, 2 bajas). Next.js 15.2.2 es vulnerable a, entre otras:
  - RCE no autenticada vía el protocolo de React Flight (GHSA-9qr9-h5gf-34mp, crítica; relacionada con CVE-2025-55182).
  - Bypass de autorización en middleware (GHSA-f82v-jwr5-mffw, crítica; CVE-2025-29927).
  - RCE no autenticada en la API de optimización de imágenes con SVG/AVIF (GHSA-2464-fhr4-w9xw, GHSA-2xp9-vwfh-vxw4).
- **Corrección:** actualizar Next.js a la versión parcheada indicada por `npm audit` (**15.5.29** es la sugerida dentro de la misma versión mayor). Ver `npm-audit.json` para el listado completo.

---

## 3. Hallazgos altos

### A-01 · XSS almacenado vía IP en el panel de analytics
- **Ubicación:** `app/api/tracking/route.ts` (la IP se guarda tal cual de `X-Forwarded-For`); `app/admin/analytics/AnalyticsClient.tsx:366` (`dangerouslySetInnerHTML={{ __html: visit.ip }}`).
- **Impacto:** cualquier visitante inyecta HTML/JS que se ejecuta en el navegador de un administrador al abrir analytics → acciones como admin (las cookies son httpOnly, pero las peticiones se hacen con la sesión de la víctima).
- **Corrección:** eliminar `dangerouslySetInnerHTML` y renderizar texto; validar y normalizar la IP.

### A-02 · Valores de flags y secretos expuestos sin autenticación
- **Ubicación:** `app/api/flags/route.ts` (GET lista todos los flags con su `flag`), `app/api/flags/[slug]/route.ts` (devuelve el flag completo).
- **Descripción:** ambos endpoints son públicos y devuelven el valor del secreto.
- **Corrección:** no devolver el valor; si la funcionalidad es necesaria, restringir a administradores.

### A-03 · IDOR: detalle de pedidos de otros usuarios
- **Ubicación:** `app/api/orders/[id]/route.ts:60-61` — si `order.userId !== user.id` el usuario recibe igualmente nombre, email, dirección y total, y solo se añade un "flag".
- **Impacto:** cualquier usuario registrado lee datos personales de cualquier pedido (los IDs son secuenciales: `ORD-001`…).
- **Corrección:** devolver 404 si el pedido no es del usuario (o no es admin).

### A-04 · IDOR: wishlists privadas de otros usuarios
- **Ubicación:** `app/api/wishlists/[id]/route.ts:72-80` — el GET no comprueba `isPublic` ni la propiedad; devuelve `ownerEmail` e ítems.
- **Corrección:** permitir lectura solo al propietario, o a cualquiera si `isPublic === true`.

### A-05 · Tokens de compartición falsificables (cifrado sin autenticación y clave por defecto)
- **Ubicación:** `lib/share-crypto.ts:7-9` (clave por defecto en código: `a1b2c3d4…` si no hay `SHARE_ENCRYPTION_KEY`); `lib/share-crypto.ts:14` (AES-256-CBC sin MAC); `app/api/documents/share/route.ts`.
- **Descripción:** con la clave conocida, cualquiera cifra `order:<id>` o `report:internal` y obtiene el recurso. CBC sin HMAC también es maleable. No hay expiración ni revocación.
- **Impacto:** lectura de datos de cualquier pedido (nombre, dirección, ítems) y de los recursos "internos".
- **Corrección:** exigir `SHARE_ENCRYPTION_KEY`; usar AES-256-GCM o HMAC + cifrado (encrypt-then-MAC); incluir caducidad y revocar; no usar el ID del recurso como único control de acceso.

### A-06 · Precio del pedido controlado por el cliente
- **Ubicación:** `app/api/orders/route.ts:61-82, 130` — se calcula `expectedTotal` pero se guarda `total: total` (el valor enviado por el cliente). La diferencia solo genera un flag en la respuesta.
- **Impacto:** pedidos a cualquier precio (incluido 0,01 €) y facturas con importes falsos.
- **Corrección:** usar siempre el total calculado en servidor a partir de precios de BD; rechazar si el cliente envía otro valor.

### A-07 · Control de acceso roto en el stream en directo (BFLA y exposición de la clave RTMP)
- **Ubicación:** `app/api/live/stream/route.ts:30` (GET con `withAuth`), `:56` (POST con `withAuth`, no `withAdminAuth`); `lib/live-stream.ts:13-14` (`rtmpUrl`, `streamKey`).
- **Descripción:** cualquier usuario registrado puede cambiar el vídeo público (`liveVideoId`) y leer la **clave de ingest RTMP** (`streamKey`) que devuelve el GET.
- **Corrección:** `withAdminAuth` en POST; no devolver `streamKey` salvo a admin; no tener la clave en el código (`STREAM_DEFAULTS`).

### A-08 · Inyección SQL autenticada en el panel de reseñas (`db.exec`)
- **Ubicación:** `app/api/admin/reviews/route.ts:113, 120, 133` — `authorFilter` se interpola y se ejecuta con `db.exec(query)` (acepta múltiples sentencias, incluidas escrituras).
- **Impacto:** requiere admin, pero permite modificar o borrar la base de datos (`'; DELETE FROM …`).
- **Corrección:** consultas parametrizadas; nunca `db.exec` con entrada del usuario.

### A-09 · XXE en la importación de pedidos de proveedor
- **Ubicación:** `app/api/admin/suppliers/import-order/route.ts:22-23` — `libxmljs.parseXmlString(rawXml, { noent: true, dtdload: true })`. Los errores devuelven el mensaje de parser al cliente.
- **Impacto:** lectura de ficheros locales y SSRF mediante entidades externas (requiere admin).
- **Corrección:** `noent: false`, `dtdload: false`, `nonet: true`; no devolver mensajes internos.

### A-10 · Endpoint de diagnóstico protegido por token hardcodeado
- **Ubicación:** `app/api/admin/diag/route.ts:5-6` — cabecera `x-debug-auth` con un valor fijo en el código (`dbg_8f3a…`), y devuelve un flag.
- **Corrección:** eliminar el endpoint o protegerlo con `withAdminAuth`; no usar secretos en el código.

### A-11 · Secretos en el repositorio y en la imagen Docker
- **Ubicación:**
  - `.env.local` está versionado con `NEXT_PUBLIC_PAYMENT_SECRET` y un flag.
  - `supplier-registry.txt` contiene `api_key=…`.
  - `flag.txt` y `public/notice.txt` contienen valores secretos; `public/` se sirve estáticamente, así que `notice.txt` es accesible públicamente.
  - `.dockerignore` excluye `.env` pero **no** `.env.local`, y el Dockerfile hace `COPY . .` → el secreto queda dentro de la imagen.
- **Corrección:** rotar todos los valores; quitarlos del repositorio y de `public/`; añadir `.env*` a `.dockerignore`; usar secretos de runtime (no `COPY`).

### A-12 · Contenedor ejecutándose como root y sin hardening
- **Ubicación:** `Dockerfile` (sin `USER`; `docker-compose.yml` sin `read_only`, `cap_drop` ni `security_opt`).
- **Corrección:** crear usuario no privilegiado (`USER node`), filesystem de solo lectura salvo `/app/data`, `uploads` y `logs`, y `cap_drop: [ALL]`.

---

## 4. Hallazgos medios

| ID | Hallazgo | Ubicación | Corrección resumida |
|---|---|---|---|
| M-01 | MD5 sin sal para contraseñas; contraseñas semilla débiles (`admin`, `qwerty`…) | `lib/server-auth.ts` (`hashMD5`), `prisma/seed.ts:576-714` | bcrypt/argon2id; forzar cambio de contraseña en semillas |
| M-02 | Sin rate limiting en login, reset, support-login, hints, etc. | Todas las rutas de auth | Límite por IP/cuenta y backoff |
| M-03 | Sin cabeceras de seguridad (CSP, `X-Frame-Options`, `Referrer-Policy`, HSTS) | `next.config.ts` | Configurar `headers()` |
| M-04 | Sesiones JWT sin revocación; logout solo borra la cookie; caducidad de 7 días; `secure` solo en producción | `lib/server-auth.ts`, `app/api/auth/logout/route.ts` | Sesiones en servidor o lista de revocación; caducidad más corta |
| M-05 | Token de sesión en la query string (`/api/auth/support-login?token=`) | `app/support-login/page.tsx`, `app/api/auth/support-login/route.ts` | Intercambio por POST y cookie; no loguear URL |
| M-06 | XSS almacenado en la bio del perfil (`dangerouslySetInnerHTML`) | `app/profile/ProfileClient.tsx:411` | Renderizar como texto o sanitizar |
| M-07 | SVG subido por admin servido con `image/svg+xml` desde el mismo origen (puede contener script) | `app/api/admin/products/[id]/image/route.ts:14, 94`; `app/api/uploads/[...path]/route.ts` | Sanitizar SVG, servir con `Content-Disposition: attachment` o `Content-Security-Policy: sandbox`, o rechazar SVG |
| M-08 | Códigos de regalo derivados de un LCG sembrado con `Date.now()` → predecibles | `lib/gift-card.ts`, `app/api/gift-cards/route.ts` | CSPRNG (`crypto.randomBytes`) |
| M-09 | Race condition en cupones (comprobación y uso no atómicos; `setTimeout` de 150 ms) | `app/api/orders/route.ts:73-88` | Transacción con condición en UPDATE (`usedCount < maxUses`) |
| M-10 | Secreto de pago en el bundle del cliente y no validado en servidor (`X-Payment-Auth` no se comprueba) | `app/checkout/CheckoutClient.tsx:119, 140` | Quitar el secreto del cliente; autenticar el pago en servidor |
| M-11 | Endpoint `/api/hints/reveal` público que modifica el estado global | `app/api/hints/reveal/route.ts` | Autenticación y registro por usuario |
| M-12 | Fuga de información en errores: stack traces y diagnósticos en la exportación de datos; `password` (hash) exportable | `app/api/user/export/route.ts` (`ALLOWED_USER_FIELDS`, línea 7; `getSystemDiagnostics` y los bloques de error) | Quitar `password` de campos exportables; respuestas de error genéricas |

---

## 5. Hallazgos bajos

- **B-01** Reseñas con autor suplantable sin autenticación (`app/api/products/[id]/reviews/route.ts`).
- **B-02** Parámetro `redirect` del login guardado en una cookie que luego se usa en `/internal/oauth/callback` sin validación de destino (`app/api/auth/login/route.ts`).
- **B-03** Logs con PII (email de destinatario de regalo, emails de usuario) en `logs/app.log` (`app/api/gift-cards/route.ts`).
- **B-04** El cliente guarda el objeto `user` (incluido el `role`) en `localStorage` (`lib/client-auth.ts`) y lo usa para decidir qué UI mostrar. La protección real está en el servidor, pero no conviene basar decisiones de interfaz en ese dato, que cualquiera puede modificar.

---

## 6. Dependencias (`npm audit`)

Resumen (`npm-audit.json`): **53 vulnerabilidades** — 3 críticas, 21 altas, 27 moderadas, 2 bajas.

| Paquete | Versión actual | Severidad máxima | Corrección |
|---|---|---|---|
| `next` | 15.2.2 | Crítica | Actualizar a **15.5.29** (la sugerida por npm; comprobar compatibilidad) |
| `prisma` / `@prisma/client` | ^6.19.1 | Alta (rango 6.13.0-dev → 7.10.0) | Actualizar a 7.10.1+ (cambio de versión mayor, probar migraciones) |
| `zod` | ^4.4.1 | Alta (consumo de memoria con colecciones grandes) | Actualizar a ≥ 4.6.6 |
| `libxmljs2` | ^0.37.0 | Moderada | Revisar advisory; mitigar en código (ver A-09) |
| `@babel/core` (dev) | — | Baja | Actualizar |
| `cypress`, `@cypress/request`, otros devDependencies | — | Moderada | Solo afectan al entorno de desarrollo/CI; actualizar cuando sea posible |

Recomendación: ejecutar `npm audit fix` para los cambios sin rotura y tratar las mayores (Next, Prisma) como tareas separadas con pruebas.

---

## 7. Aspectos positivos

- Uso mayoritario de Prisma (consultas parametrizadas) en la mayor parte de la API.
- Wrappers `withAuth` / `withAdminAuth` en la mayoría de rutas sensibles, y validación de entrada con Zod.
- Cifrado de tokens con IV aleatorio por operación (`randomBytes(16)`).
- Protección de path traversal en `/api/uploads` (aunque la lógica de `/api/files` no la tiene).
- Comprobación de propiedad en carrito (`/api/cart/items/[id]`) y en wishlists (POST/DELETE).

---

## 8. Plan de corrección priorizado

1. **Inmediato (antes de cualquier exposición):** C-01, C-02, C-03, C-08, C-06, C-07, C-09 — todos explotables sin autenticación o con autoregistro. Rotar todos los secretos expuestos (A-11, C-10, `JWT_SECRET` si se usó el valor por defecto, clave de share, clave RTMP, claves de API).
2. **Corto plazo:** C-04, C-05, C-10 (quitar contraseñas de logs), A-01, A-03, A-04, A-05, A-06, A-07, A-02.
3. **Dependencias:** actualizar Next.js (C-11) y revisar Prisma/zod.
4. **Endurecimiento:** A-08 a A-12, M-01 a M-12 (hashing con bcrypt/argon2, rate limiting, cabeceras, Docker no-root, revocación de sesiones).
5. **Proceso:** revisión de código de seguridad en PR, tests de autorización por rol, SAST/DAST en CI, y un checklist de OWASP Top 10 antes de desplegar.

---

## 9. Artefactos generados

- `auditoria-seguridad.md` — este informe.
- `npm-audit.json` — salida completa de `npm audit --package-lock-only --json`.

*Informe elaborado por análisis estático. Antes de corregir o de dar por cerrado un hallazgo, reprodúcelo en un entorno aislado.*
