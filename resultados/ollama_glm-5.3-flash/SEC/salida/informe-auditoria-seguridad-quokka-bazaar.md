# Informe de Auditoría de Seguridad — Quokka Bazaar v2.17.0

**Fecha de auditoría:** 23 de noviembre de 2026
**Alcance:** Código fuente completo (`app/`, `lib/`, `prisma/`, `middleware.ts`, configuración Docker, scripts)
**Metodología:** Revisión estática de código (SAST manual) + análisis de configuración e infraestructura. Referencias OWASP Top 10 2021 y CWE.
**Tipo de aplicación:** E-commerce Next.js 15 (App Router) + Prisma/SQLite, panel de administración, gift cards, cupones, asistente IA, SIEM interno, MCP server.

> ⚠️ **Contexto:** el proyecto es deliberadamente inseguro (aplicación tipo reto/CTF con flags `QKB{...}`). Este informe documenta los hallazgos con el mismo rigor que en un proyecto de producción; muchos de ellos corresponden a las vulnerabilidades plantadas en el código.

---

## 1. Resumen Ejecutivo

| Severidad | Hallazgos |
|---|---|
| 🔴 **Crítica** | 9 |
| 🟠 **Alta** | 10 |
| 🟡 **Media** | 7 |
| 🔵 **Baja / Informativa** | 8 |

**Conclusiones principales:**

1. **Compromiso total de la aplicación sin ninguna credencial** es posible mediante 4 rutas independientes: escalada de rol en el registro, SQLi no autenticada, lectura arbitraria de archivos sin autenticación y forja de JWT con el secreto por defecto.
2. **Toda la base de datos de secretos (flags) se expone públicamente** en `/api/flags` sin autenticación.
3. **Autenticación y criptografía rotas en su base:** contraseñas con MD5 sin salt, tokens de reset de contraseña predecibles en función de un timestamp que la propia API revela, JWT con secreto por defecto `"secret"`, secretos hardcodeados en el source y en `.env.local` (incluido un secreto con prefijo `NEXT_PUBLIC_`, que se filtra al bundle del cliente).
4. **XSS almacenado con ejecución de `<script>`** en reviews (inyectable sin autenticación) y en el panel de administración (encadenado con SQLi en tracking y con SSRF).
5. **Fraude transaccional:** el total del pedido se acepta del cliente; los cupones tienen condición de carrera que permite superar `maxUses`; los códigos de gift card son predecibles (LCG con semilla de timestamp) y se pueden redimir por fuerza bruta.
6. **Gestión de secretos inexistente:** 3 archivos con secretos en el repositorio, tokens/claves hardcodeados, y todo el proyecto se copia a la imagen Docker (`COPY . .`).

---

## 2. Inventario de Endpoints y Estado de Autenticación

| Endpoint | Auth | Nota |
|---|---|---|
| `POST /api/auth/signup` | ❌ | **Acepta `role` del cliente** |
| `POST /api/auth/login` | ❌ | Loguea la contraseña en texto plano |
| `POST /api/auth/forgot-password` | ❌ | Token predecible, `requestedAt` en la respuesta |
| `POST /api/auth/reset-password` | ❌ | Valida token (predecible) |
| `GET /api/auth/support-login` | ❌ | Token opaco en query string |
| `GET /api/flags`, `/api/flags/[slug]` | ❌ | **Devuelve TODOS los secretos (flags) de la BD** |
| `GET /api/files` | ❌ | **Path traversal + listing de directorios** |
| `GET /api/products`, `[id]`, `/search` | ❌ | `/search` con SQLi |
| `POST /api/products/[id]/reviews` | ❌ | Autor falsificable, contenido sin sanitizar |
| `POST /api/tracking` | ❌ | SQLi vía headers |
| `POST /api/support` | ❌ | SSRF con header interno |
| `POST /api/ai-assistant`, `/api/mcp` | ❌ | Prompt injection, herramienta privilegiada con header constante |
| `POST /api/monitoring/auth`, `GET /api/monitoring/logs` | Cookie forjable (`siem_session=authenticated`) + creds `root:admin` hardcodeadas |
| `withAuth` (genérico) | Cookie `authToken` (JWT, firma verificada en `lib/server-auth.ts`) |
| `withAdminAuth` | Verifica `role === "ADMIN"` del JWT |

---

## 3. Hallazgos Críticos

### F-01 · Escalada de privilegios: asignación de `role` en el registro
- **Severidad:** 🔴 Crítica | **CWE-269 (Improper Privilege Management)** / OWASP A01
- **Ubicación:** `app/api/auth/signup/route.ts:59-61`, `lib/validation/schemas/auth.ts:3-9`
- **Descripción:** el schema de signup acepta un campo `role` opcional y el controlador lo pasa tal cual al crear el usuario: `if (body.role) { userData.role = body.role as UserRole; }`. Un atacante puede registrarse directamente como `ADMIN`.
- **PoC:** `POST /api/auth/signup` → `{"email":"eve@evil.com","password":"12345678","role":"ADMIN"}`
- **Impacto:** acceso total al panel de administración, proveedores, reviews audit, analytics, gestión de pedidos.
- **Mitigación:** eliminar el campo del schema o forzar `role: UserRole.CUSTOMER` siempre en servidor; nunca mapear entrada de usuario a campos de rol.

### F-02 · Exposición pública de todos los secretos internos (`/api/flags`)
- **Severidad:** 🔴 Crítica | **CWE-200 (Exposure of Sensitive Information)** / OWASP A01
- **Ubicación:** `app/api/flags/route.ts` (sin auth), `app/api/flags/[slug]/route.ts`
- **Descripción:** `GET /api/flags` devuelve **todos los registros** con el campo `flag` (más de 30 valores `QKB{...}`), sin ningún tipo de autenticación. `GET /api/flags/[slug]` hace lo mismo individualmente.
- **Impacto:** en producción equivaldría a publicar todos los tokens/valores secretos de la BD. Anula el resto de retos del proyecto.
- **Mitigación:** restringir por `withAdminAuth`, y jamas servir el campo `flag` (excluir con `select`).

### F-03 · Path traversal y lectura arbitraria de archivos sin autenticación (`/api/files`)
- **Severidad:** 🔴 Crítica | **CWE-22 (Path Traversal)** / OWASP A01
- **Ubicación:** `app/api/files/route.ts:19-67`; la UI client-side sí exige admin (`app/admin/documents/DocumentsClient.tsx:124-161`) pero **el endpoint no**
- **Descripción:** `file`, `path` y `list` se concatenan con `path.join(baseDir, ...)` sin sanitización y sin restricción de extensión, y el endpoint es accesible anónimamente.
- **PoC:** `GET /api/files?file=../flag.txt` · `GET /api/files?file=../.env.local` · `GET /api/files?file=../prisma/dev.db` (dump íntegro de usuarios con hash MD5) · `GET /api/files?list=true&path=../`
- **Mitigación:** `withAdminAuth` + `path.resolve` y verificación de prefijo + whitelist de extensiones + no servir DB.

### F-04 · SQLi no autenticada en tracking (vector: `X-Forwarded-For`)
- **Severidad:** 🔴 Crítica | **CWE-89** / OWASP A03
- **Ubicación:** `app/api/tracking/route.ts:96-103` (`prisma.$queryRawUnsafe` con interpolación de `ip`, `sessionId` — estos dos no van escapados)
- **Descripción:** `ip` proviene del header `X-Forwarded-For` (controlado por el cliente) y se interpola directamente en el INSERT. `sessionId` también viaja sin escapar en el JSON body.
- **PoC:** `curl -X POST /api/tracking -H "X-Forwarded-For: hax',(SELECT group_concat(email||':'||password) FROM users))-- -" ...` (exfiltración de credenciales MD5 de todos los usuarios). Encadena con el XSS de F-14 vía la columna `ip` mostrada en administración.
- **Mitigación:** consultas parametrizadas (`prisma.$executeRaw` con placeholders) y validación estricta del formato de IP.

### F-05 · SQLi no autenticada en búsqueda de productos
- **Severidad:** 🔴 Crítica | **CWE-89** / OWASP A03
- **Ubicación:** `app/api/products/search/route.ts:85-96` (`WHERE name LIKE '%${query}%'`)
- **PoC:** `GET /api/products/search?q=' OR 1=1--` · exfiltración: `' UNION SELECT id, flag, flag, 0, 0 FROM flags--`
- **Mitigación:** parametrizar o usar Prisma `findMany({ where: { name: { contains } } })`.

### F-06 · SQLi autenticada en búsqueda de pedidos
- **Severidad:** 🔴 Crítica (bajo autenticación, cualquier cuenta) | **CWE-89** / OWASP A03
- **Ubicación:** `app/api/orders/search/route.ts:81-98` — interpolación de `status` (y de `user.id`, manipulable si se falsifica el JWT: F-09)
- **PoC:** `POST /api/orders/search` → `{"status":"SHIPPED' UNION SELECT 1,flag,2,3,4,5,6,7,8 FROM flags--"}`
- **Nota:** además existe un filtro defensivo que elimina valores `qkb{` de los resultados — no limita la exfiltración real (concatenación `'||flag||'` la evita).
- **Mitigación:** enum whitelist + `$queryRaw` con placeholders.

### F-07 · SQLi en auditoría de reviews (admin)
- **Severidad:** 🔴 Crítica | **CWE-89** / OWASP A03
- **Ubicación:** `app/api/admin/reviews/route.ts:103-134` — `WHERE r.author = '${authorFilter}'` (también ejecutado con `db.exec`).
- **Mitigación:** `better-sqlite3` con `.prepare().all(authorFilter)` parametrizado.

### F-08 · Restablecimiento de contraseña predecible → Account Takeover
- **Severidad:** 🔴 Crítica | **CWE-640 / CWE-330** / OWASP A07
- **Ubicación:** `app/api/auth/forgot-password/route.ts:21-43`
- **Descripción:** el token es `md5(email + timestamp)`; el endpoint **devuelve `requestedAt` (ISO con ms)** en la respuesta, por lo que el epoch (`Math.floor(getTime()/1000)`) es trivialmente calculable. No se envía email: el token queda en BD listo para `/api/auth/reset-password`.
- **PoC:** `POST /api/auth/forgot-password {"email":"admin@quokka.store"}` → leer `requestedAt` → `token = md5(email + floor(ts/1000))` → `POST /api/auth/reset-password {"token":..., "password":"pwn123"}`.
- **Mitigación:** `crypto.randomBytes(32)` para el token, caducidad corta, no revelar ningún dato correlacionado.

### F-09 · JWT con secreto por defecto débil → forja de sesión ADMIN
- **Severidad:** 🔴 Crítica | **CWE-321 / CWE-798** / OWASP A02/A05
- **Ubicación:** `lib/server-auth.ts:12` (`process.env.JWT_SECRET || "secret"`). `JWT_SECRET` **no está definido** en `.env.local` ni en `docker-compose.yml`, por lo que se usa el valor por defecto.
- **PoC:** firmar `{"id":"<userId>","email":"x","role":"ADMIN","exp":<futuro>}` con `secret` (HS256) → cookie `authToken` válida.
- **Mitigación:** secret de ≥32 bytes generado aleatoriamente y fallo rápido (exit) si no está configurado.

---

## 4. Hallazgos de Severidad Alta

### F-10 · Tokens de soporte para cualquier usuario (BOLA) → toma de cuenta
- **Severidad:** 🟠 Alta (crítica si se encadena con F-01/F-09) | **CWE-639 / A01**
- **Ubicación:** `app/api/user/support-access/route.ts:51-101` — `POST` con `withAuth` acepta `email` del body para crear un token de acceso a **otra** cuenta (incluida la del admin), con caducidad de **365 días**; `GET /support-login?token=...` entrega la sesión de esa cuenta.
- **Mitigación:** limitar `targetEmail` al propio `user.email` salvo rol admin; caducidad ≤ 1 h; auditoría y revocación.

### F-11 · Contraseñas con MD5 sin salt
- **Severidad:** 🟠 Alta | **CWE-916 / A02**
- **Ubicación:** `lib/server-auth.ts:14-16`, `prisma/seed.ts:576-578`, login/signup/reset.
- **Descripción:** MD5 (rápido, sin sal) permite tablas precalculadas y cracking masivo si la BD se filtra (y F-03 la expone). Contraseñas sembradas triviales (`admin`/`admin`, `qwerty`, `sunshine`, `iloveduck`).
- **Mitigación:** bcrypt/argon2id con coste adecuado.

### F-12 · Falsificación del total del pedido (manipulación de precio)
- **Severidad:** 🟠 Alta | **CWE-592 / A04 (Insecure Design)**
- **Ubicación:** `app/api/orders/route.ts:35-218` (crea pedido con `total` del body sin verificar); `app/checkout/CheckoutClient.tsx:136` (envía total calculado en cliente); cupón validado en cliente (`/api/coupon/apply` solo calcula).
- **Impacto:** pedido con cualquier total (p. ej. `0.01`) independiente del carrito.
- **Mitigación:** recalcular total en servidor desde `cartItems` y aplicar cupones atómicamente en servidor.

### F-13 · XXE en importación de pedidos de proveedores
- **Severidad:** 🟠 Alta (requiere admin, pero F-01 lo hace alcanzable) | **CWE-611 / A05**
- **Ubicación:** `app/api/admin/suppliers/import-order/route.ts:21-24` — `libxmljs.parseXmlString(rawXml, { noent: true, dtdload: true })`.
- **PoC:** entidad externa `file:///app/supplier-registry.txt` (contiene `api_key`) o `../.env.local`; errores del parser reflejan el contenido (`Failed to parse XML: ...`).
- **Mitigación:** `noent:false`, `dtdload:false`, `dtdattr:false` o parser sin soporte DTD.

### F-14 · XSS almacenado con ejecución de `<script>` en reviews
- **Severidad:** 🟠 Alta | **CWE-79 / A03**
- **Ubicación:** `app/products/[id]/ProductDetailClient.tsx:45-67` (`reviewElement.innerHTML = review.content` + re-creación de nodos `<script>` para forzar su ejecución) + API `POST /api/products/[id]/reviews` **sin auth, sin sanitización y con autor falsificable**.
- **Impacto:** inyección de JS persistente en la página pública del producto para todos los visitantes (incl. admin): acciones en su nombre, exfiltración de datos, desfiguración.
- **Mitigación:** renderizar como texto (React por defecto), eliminar el bloque de re-creación de scripts; sanitizar server-side si HTML es necesario.

### F-15 · SSRF + XSS en formulario de soporte
- **Severidad:** 🟠 Alta | **CWE-918 / A10** + CWE-79
- **Ubicación:** `app/api/support/route.ts:14-28` (`fetch(screenshotUrl)` sin restricciones desde endpoint sin auth, añade header `X-Internal-Request: true`) y `app/support/SupportForm.tsx:101-106` (`dangerouslySetInnerHTML` del contenido descargado).
- **Descripción:** el servidor GETea cualquier URL arbitraria (incl. `http://localhost:3000/...`, servicios internos/cloud metadata) y devuelve el contenido; el cliente lo inyecta como HTML.
- **Cadena:** SSRF a `/internal` (que se concede por el header `x-internal-request`, ver F-29) o a cualquier endpoint; la respuesta puede contener JS → XSS en el navegador del usuario.
- **Mitigación:** whitelist de hosts/esquemas, bloquear IP privadas/link-local, descartar el cuerpo (o renderizarlo como texto), sanear.

### F-16 · Credenciales SIEM hardcodeadas y sesión estática falsificable
- **Severidad:** 🟠 Alta | **CWE-798 / A07**
- **Ubicación:** `app/api/monitoring/auth/route.ts:5-6` y `app/api/monitoring/logs/route.ts:7-8` — `root/admin`; cookie `siem_session=authenticated` **aceptada tal cual si coincide el valor** (no firmada).
- **Impacto:** lectura de todos los logs con una cookie inventada (`document.cookie="siem_session=authenticated"`). Los logs incluyen **contraseñas en texto plano** (F-19) → ATO de cualquier usuario que haya iniciado sesión.
- **Mitigación:** credenciales en env/secretos, cookie de sesión firmada opaca, rate-limiting.

### F-17 · Contraseñas registradas en texto plano
- **Severidad:** 🟠 Alta | **CWE-532 / A09**
- **Ubicación:** `app/api/auth/login/route.ts:16-25` (`logger.warn` con `password` tanto en campo como en mensaje) + `instrumentation.node.ts` (persistencia sin filtrar en `logs/app.log`, leíble por F-16) y `pino.destination("logs/app.log")`.
- **Impacto:** cualquier acceso a logs (SIEM, disco, backups) expone credenciales de usuarios.
- **Mitigación:** jamas loguear credenciales; redactar campos sensibles en serializer.

### F-18 · Códigos de gift card predecibles → robo de valor
- **Severidad:** 🟠 Alta | **CWE-330 / A02**
- **Ubicación:** `lib/gift-card.ts:5-25` (LCG `state*1103515245+12345` sembrado con `createdAt.getTime()` en ms) y `app/api/gift-cards/route.ts:51-52` (crea el código con `new Date()` — rango de ms adivinable); `prisma/seed.ts` sembró una tarjeta de $500 con fecha conocida (`2025-01-15T10:42:33.456Z`).
- **Descripción:** el espacio de códigos es enumerable offline por fuerza bruta del timestamp; el endpoint de redención comprueba contra todos los PENDING y aplica crédito.
- **Mitigación:** `crypto.randomBytes` para códigos; rate-limiting y límite de intentos en redeem.

### F-19 · Race condition en canje de cupones
- **Severidad:** 🟠 Alta | **CWE-367 / A04**
- **Ubicación:** `app/api/orders/route.ts:64-88` — check `usedCount < maxUses` → `setTimeout(150ms)` → `update({ increment: 1 })` sin re-validación, sin transacción y sin constraint.
- **Impacto:** peticiones concurrentes superan `maxUses` (descuento 50% ilimitado).
- **Mitigación:** transacción con `updateMany({ where: { code, usedCount: { lt: maxUses } } })` y verificar `count`.

### F-20 · Subida de imágenes: SVG + path traversal en nombre de archivo
- **Severidad:** 🟠 Alta (admin) | **CWE-434 / CWE-22**
- **Ubicación:** `app/api/admin/products/[id]/image/route.ts:9-15, 79-87` — se acepta `image/svg+xml` (se sirve con `Content-Type: image/svg+xml` en `app/api/uploads/[...path]/route.ts`) → **XSS almacenado** vía SVG con scripts, servido desde el origen de la app; además `filename = ${id}-...` sin sanear `id` del path del segmento URL → escritura fuera de `uploads/` (`id`: `../../documents/invoices/x`).
- **Mitigación:** rechazar SVG (o servirlo forzando `Content-Type: text/plain` desde otro origen), sanear/validar `id` contra BD, normalizar y verificar prefijo del path final.

---

## 5. Hallazgos de Severidad Media

### F-21 · Middleware decodifica JWT sin verificar firma
- **Ubicación:** `middleware.ts:3-34` — solo parsea el payload y confía en `role`. Cubre únicamente `/monitoring/internal-status`, pero es un antipatrón; si algún día se añaden Matcher adicionales sería un bypass. La versión de Next.js usada además es vulnerable a bypass de middleware (ver F-31).

### F-22 · Token de diagnóstico hardcodeado
- **Ubicación:** `app/api/admin/diag/route.ts:5-7` — `x-debug-auth: dbg_8f3a7c91e2b4d6a05e21` en código fuente; sin auth de usuario, revela build interno. Mover a secretos y requerir admin.

### F-23 · Secretos/llaves hardcodeadas en el código
- **Ubicación:** `lib/share-crypto.ts:6-10` (clave AES-256-CBC por defecto → cualquiera puede forjar tokens de compartición `order:<id>` y ver pedidos de otros con `shareUrl`), `lib/live-stream.ts:14` (`streamKey` de producción), `lib/mcp-constants.ts` (sesión MCP estática `quokka-internal-agent`, llave de la herramienta privilegiada `get_compliance_report`), `app/api/ai-assistant/route.ts:22` (código de validación dentro del prompt del sistema), `app/api/admin/products/...` (tokens en constantes), `app/api/user/export/route.ts:48-51` (flag como "diagnóstico").
- **Mitigación:** externalizar todos los secretos, rotar la clave de compartición, autenticar el MCP server con sesión real.

### F-24 · `.env.local` y secretos versionados + `NEXT_PUBLIC_` en un secreto
- **Ubicación:** `.env.local` (commit en el repo), `flag.txt`, `supplier-registry.txt` (`api_key`), `documents/` con datos internos.
- `NEXT_PUBLIC_PAYMENT_SECRET="UUtCezcyMGYyYTc3MWU1MH0="` se incrusta en el bundle del cliente (cualquier visitante puede decodificarlo — contenido en base64 visible).
- **Mitigación:** retirar del control de versiones (y de `git history`), `.gitignore` robusto, mover a secretos de runtime/país de entorno seguro; jamas `NEXT_PUBLIC_` para datos sensibles.

### F-25 · Exposición parcial de datos en exportación de usuario
- **Ubicación:** `app/api/user/export/route.ts:7` — campo `password` permitido en export propio (hash MD5 útil tras F-03); y ante campos inválidos devuelve `systemDiagnostics` con stack y datos internos.
- **Mitigación:** excluir `password` siempre; no devolver stack traces ni diagnósticos a clientes.

### F-26 · IDOR en detalle de pedido
- **Ubicación:** `app/api/orders/[id]/route.ts:8-75` — `withAuth` sin comprobar `order.userId === user.id`. IDs predecibles (`ORD-001`...). Expone email, dirección completa y detalle de pedidos de otros clientes. (El POST/PATCH sí verifica admin; el share sí verifica dueño.)
- **Mitigación:** filtrar por `userId` (o admin).

### F-27 · Open redirect tras login
- **Ubicación:** `app/login/LoginForm.tsx:36-37` — `window.location.href = redirect` con el parámetro de query tal cual (`/login?redirect=https://evil.com`). Validar origen relativo (`startsWith("/") && !startsWith("//")`).

### F-28 · Race/redención concurrente de gift cards (mitigado parcialmente)
- **Ubicación:** `app/api/gift-cards/redeem/route.ts:52-59` — la actualización es condicional (`status: "PENDING"` → `updateMany`), correcta; pero la comparación contra **todos** los códigos PENDING en memoria (línea 32-39) permite timing/enumenración y escala mal con el volumen. Además no limita intentos por usuario.
- **Mitigación:** lookup por índice del code + rate limiting.

### F-29 · Acceso "interno" controlado por header falsificable
- **Ubicación:** `app/internal/page.tsx:17-21` — `x-internal-request: true` enviado por curl basta. Enlazado con el SSRF de F-15. No deben confiar headers para autorización.

### F-30 · Filtros de prompt-injection frágiles + agente con herramientas privilegiadas
- **Ubicación:** `lib/prompt-injection-filter.ts` (4 regex fácilmente burlables) y `app/api/ai-assistant/route.ts` (permite en un endpoint público pasar `mcpServerUrl` externo + `apiKey`; el agente, con sesión interna estática (F-23), puede invocar herramientas internas como `get_compliance_report` por confusión de delegado).
- **Mitigación:** no aceptar apiKey/URL del cliente; aislar herramientas internas del agente público; validar sesiones del MCP.

---

## 6. Hallazgos Bajos / Informativos

| ID | Título | Ubicación | Nota |
|---|---|---|---|
| F-31 | Dependencias desactualizadas con CVEs conocidos | `package.json` | `next 15.2.2` (< 15.2.3; afectado por CVE-2025-29927, bypass de middleware vía header `x-middleware-subrequest`); el propio `.env.local` referencia `CVE-2025-55182` — actualizar `react`/`react-dom` (19.2.0) y `next` a último parche |
| F-32 | Token de soporte en query string y sesión de 1 año | `support-login`, `user/support-access` | Fuga vía Referer/logs; caducidad excesiva |
| F-33 | IDOR leíble en wishlist (email del propietario + contenido) | `app/api/wishlists/[id]/route.ts` | Falta check de propiedad/`isPublic`; el campo `note` no está en la respuesta pero otros datos sí |
| F-34 | Suplantación de autor en reviews | `app/api/products/[id]/reviews/route.ts:59-64` | `author` libre del cliente |
| F-35 | Rate limiting / anti-enumeración ausente (global) | Todos los endpoints | Brute-force de login, reset, códigos gift card, cupones |
| F-36 | Sin encabezados de seguridad (CSP, X-Frame-Options, HSTS, Referrer-Policy) | `next.config.ts` | Agravía los XSS (F-14/F-15) |
| F-37 | Imagen Docker incluye secretos del repo y corre como root | `Dockerfile:8-9` (`COPY . .` copia `.env.local`, `flag.txt`, `supplier-registry.txt`), sin `USER` | Multi-stage build + `.dockerignore` para secretos + usuario no privilegiado |
| F-38 | Errores genéricos diferenciales en login | `app/api/auth/login/route.ts:39-48` | `"Invalid credentials"` vs `"Invalid password"` → enumera emails |

**Notas adicionales de higiene:**
- Sesiones **no revocables** (JWT stateless, 7 días; logout solo borra cookie). Considerar `jti` + denylist o tokens de acceso de corta vida + refresh.
- `useAuth`/`getStoredUser` confían en `localStorage` para pintar UI de admin (los datos sensibles deben protegerse siempre en servidor; la UI es cosmética).
- Cantidad de endpoints de solo lectura sin control de CORS/headers; `credentials: "include"` con SameSite Lax mitiga CSRF básico, pero revisar formularios `x-www-form-urlencoded` (PATCH de pedidos y perfil lo aceptan).

---

## 7. Cadenas de Ataque Destacadas

1. **Sin credenciales → ADMIN completo:**
   `POST /api/auth/signup {"role":"ADMIN"}` (F-01) → panel admin.
2. **Sin credenciales → TODOS los secretos:**
   `GET /api/flags` (F-02), o SQLi (F-04/F-05) o ficheros (F-03: `?file=../.env.local`).
3. **Sin credenciales → ATO de cualquier cuenta:**
   `POST /api/auth/forgot-password` (F-08) → token md5 predecible → `POST /api/auth/reset-password`.
4. **SQLi no autenticada → XSS contra el admin:**
   `POST /api/tracking` con `X-Forwarded-For: <img src=x onerror=...>` (F-04) → admin abre `/admin/analytics` → el `ip` se inyecta como HTML (F-14) → JS con contexto admin.
5. **SSRF → lectura interna + XSS:**
   `/api/support` con `screenshotUrl` (F-15) → el servidor descarga e inlinea contenido (incluso de endpoints internos vía header X-Internal-Request).
6. **Fuerza de gift card offline:** LCG con semilla-timestamp (F-18) → código de la tarjeta de $500 sembrada → redención con crédito.

---

## 8. Plan de Remediación Priorizado

**Inmediato (P0 — días):**
1. Eliminar `role` del signup; añadir `withAdminAuth` a todo admin; quitar el endpoint público de `flags`.
2. Parametrizar **todas** las consultas raw (`tracking`, `products/search`, `orders/search`, `admin/reviews`): `$queryRaw` con placeholders/enum whitelist.
3. `withAdminAuth` + normalización/verificación de prefijo en `/api/files`; desactivar listing.
4. `crypto.randomBytes` para tokens de reset (y no devolver `requestedAt`), tokens de soporte (caducidad ≤ 1 h y solo para el propio email), códigos de gift card.
5. `JWT_SECRET` obligatorio ≥ 32 bytes; rotar `SHARE_ENCRYPTION_KEY`, credenciales SIEM, stream key, token de diag; mover todo a env/secret store.
6. Sustituir MD5 por bcrypt/argon2id (migración con rehash en login).

**Corto plazo (P1):**
7. Recalcular totales y cupones en servidor con transacción atómica.
8. Eliminar `innerHTML`/`dangerouslySetInnerHTML` (reviews, support, analytics) y el bloque de re-creación de `<script>`; sanitizar con DOMPurify si se requiere HTML.
9. Anti-SSRF (whitelist/redes) en `/api/support`; no confiar en headers internos.
10. Sanear subidas (bloquear SVG, validar `id`, verificación de prefijo) y servir estáticos desde otro origen.
11. Dejar de loguear contraseñas; redactor logs; proteger `/api/monitoring/logs` con sesión firmada.
12. Rate-limiting global + lockouts (+2FA para admin).

**Medio plazo (P2):**
13. Actualizar `next` (≥ 15.x último parche) y `react`/`react-dom`; auditar supply chain (`npm audit`, lockfile verificado, sin paquetes del registry interno sin revisión — indicio de `react-toastfy` en notas de desarrollo).
14. Cabeceras de seguridad (CSP estricta, HSTS, X-Frame-Options), cookies `Secure` + `__Host-`, revocación de sesiones.
15. Docker: multi-stage, `USER` no root, excluir secretos del build.
16. Test Suite de regresión de seguridad (authz por objeto en cada controller) + SAST/SCA en CI.

---

## Appendix A · Evidencia de secretos en el repositorio (a rotar)

| Archivo | Secreto/Valor observado |
|---|---|
| `.env.local` | `NEXT_PUBLIC_PAYMENT_SECRET` (prefijo público: filtrable al bundle) |
| `.env.local` | variable `FLAG_CVE_2025_55182` |
| `flag.txt` | valor `QKB{a77e424511f7}` |
| `supplier-registry.txt` | `api_key` (clave de integración) |
| Código | JWT secreto por defecto `"secret"`; clave AES por defecto; `streamKey`; token diag `dbg_8f3a7c91e2b4d6a05e21`; constantes MCP; claves en prompts |

> Todas estas credenciales deben considerarse **comprometidas** y rotarse tras las correcciones.

## Appendix B · Mapping rápido a CWE/OWASP

| Categoría | Hallazgos |
|---|---|
| A01 Broken Access Control | F-01, F-02, F-03, F-10, F-26, F-29, F-33 |
| A03 Injection (SQL/XXE/XSS) | F-04, F-05, F-06, F-07, F-13, F-14, F-15 |
| A02 Cryptographic Failures | F-08, F-09, F-11, F-18, F-23, F-24 |
| A04 Insecure Design | F-12, F-19, F-28, F-30 |
| A05 Security Misconfig | F-16, F-21, F-22, F-25, F-31, F-36, F-37 |
| A07 AuthN/AuthZ Failures | F-08, F-10, F-16, F-32, F-38 |
| A09 Logging Failures | F-17, F-25 |
| A10 SSRF | F-15 |

---

*Informe generado por análisis estático del código fuente. Recomendación de verificación dinámica (DAST) tras aplicar las correcciones P0 para confirmar el cierre de cada hallazgo.*
