# Auditoría de seguridad — Quokka Bazaar v2.17.0

**Fecha:** 2026-11-24
**Alcance:** todo el código fuente del repositorio (Next.js 15 App Router, Prisma/SQLite, ~200 ficheros): rutas `app/api/**`, páginas y componentes cliente, `lib/`, `middleware.ts`, Docker, scripts y dependencias declaradas.
**Método:** revisión manual del código (análisis estático). No se ha levantado la aplicación ni se han ejecutado exploits; los vectores descritos se deducen del código.

> **Nota de contexto:** el proyecto contiene `flag.txt`, una tabla `Flag` con *walkthroughs* en `prisma/seed.ts`, endpoints `/api/flags/*` y cadenas `QKB{...}` repartidas por el código. Parece una **aplicación vulnerable a propósito (entrenamiento/CTF)**. El informe trata cada fallo como si fuera un sistema real. **No se debe desplegar en un entorno expuesto.**

---

## 1. Resumen ejecutivo

| Severidad | Nº |
|---|---|
| 🔴 Crítica | 14 |
| 🟠 Alta | 16 |
| 🟡 Media | 11 |
| 🔵 Baja / Informativa | 7 |

Los riesgos más graves:

1. **Cualquiera puede hacerse ADMIN:** al registrarse se acepta el campo `role`; el secreto JWT por defecto es `"secret"`; con un token de soporte se puede suplantar a cualquier cuenta; el token de reseteo de contraseña es predecible.
2. **RCE / lectura de ficheros del servidor:** React 19.2.0 (CVE-2025-55182), XXE en la importación XML, *path traversal* en `/api/files`, inyección SQL apilada en un endpoint de administración.
3. **SQL injection** en 4 endpoints, uno de ellos sin autenticación.
4. **SSRF** en dos endpoints públicos (`/api/support` y `/api/ai-assistant`).
5. **XSS almacenado** en las reseñas de producto (se ejecutan incluso las etiquetas `<script>`), en la analítica del panel admin, en la subida de SVG y en el formulario de soporte.
6. **Secretos y credenciales hardcodeados** en el código, en el bundle del cliente, en la imagen Docker y en los logs, donde además se guardan las contraseñas en claro.

---

## 2. Hallazgos críticos

### C-01 · Escalada de privilegios en el registro (mass assignment)
- **Fichero:** `app/api/auth/signup/route.ts:59-61`, `lib/validation/schemas/auth.ts` (`role: z.string().optional()` + `.passthrough()`)
- **Detalle:** el cuerpo admite `role` y se copia tal cual al usuario creado. Basta con `POST /api/auth/signup {"email":"x@x","password":"x","role":"ADMIN"}` para obtener una sesión de administrador.
- **Corrección:** quitar `role` del esquema, usar `.strict()` y asignar siempre el rol `CUSTOMER` en el servidor.

### C-02 · Secreto JWT débil por defecto y validación incompleta
- **Fichero:** `lib/server-auth.ts:12`, `:41`
- **Detalle:** `JWT_SECRET = process.env.JWT_SECRET || "secret"`. Ni `.env.local`, ni el Dockerfile, ni docker-compose definen `JWT_SECRET`, así que en la práctica la firma usa `"secret"` y cualquiera puede forjar un token con `role: "ADMIN"`. La firma se compara con `!==`, que no es de tiempo constante, y la cabecera `alg` no se valida.
- **Corrección:** exigir un `JWT_SECRET` aleatorio de ≥256 bits y abortar el arranque si falta; usar `jsonwebtoken` (ya está en las dependencias) con `algorithms: ["HS256"]`, o comparar con `crypto.timingSafeEqual`.

### C-03 · Middleware que no verifica la firma del JWT + CVE-2025-29927
- **Ficheros:** `middleware.ts:3-20`, `package.json` (`next: 15.2.2`)
- **Detalle:** `decodeJWT` solo decodifica el payload en base64 y no comprueba la firma, así que un token inventado con `{"role":"ADMIN"}` da acceso a `/monitoring/internal-status`. Además, Next 15.2.2 es vulnerable a **CVE-2025-29927**: con la cabecera `x-middleware-subrequest` el middleware se salta por completo.
- **Corrección:** verificar la firma en el middleware (por ejemplo con `jose`, que funciona en Edge), actualizar Next a ≥15.2.3 (mejor, a la última 15.x) y repetir siempre la autorización en la propia página o ruta.

### C-04 · RCE en React Server Components (CVE-2025-55182, "React2Shell")
- **Fichero:** `package.json` (`react` / `react-dom` 19.2.0, `next` 15.2.2)
- **Detalle:** las versiones fijadas están afectadas por la deserialización insegura del protocolo Flight de RSC, que permite **ejecución remota de código sin autenticación**. El propio `.env.local` contiene una variable `FLAG_CVE_2025_55182`.
- **Corrección:** actualizar React a ≥19.2.1 y Next.js a la versión parcheada de su rama, y regenerar `package-lock.json`.

### C-05 · Toma de control de cualquier cuenta mediante tokens de soporte
- **Ficheros:** `app/api/user/support-access/route.ts:58-80`, `app/api/auth/support-login/route.ts`
- **Detalle:** `POST /api/user/support-access {"email":"admin@quokka.store"}` genera un token de acceso de soporte **para la cuenta que se indique**, no solo para la propia, y lo devuelve en la respuesta. `GET /api/auth/support-login?token=…` entrega entonces una sesión de un año de esa víctima. `support-login` tampoco comprueba `revoked`, así que revocar el token no sirve de nada.
- **Corrección:** ligar siempre el token a `user.id`, comprobar `revoked`, reducir la validez a horas, exigir el consentimiento del usuario y emitir sesiones con un alcance limitado.

### C-06 · Token de restablecimiento de contraseña predecible
- **Fichero:** `app/api/auth/forgot-password/route.ts:22`, `:42`
- **Detalle:** `token = md5(email + unixTimestamp)` y la respuesta devuelve `requestedAt`, de donde sale el timestamp exacto. Un atacante calcula el token de cualquier email y llama a `/api/auth/reset-password`: **takeover de cualquier cuenta**, incluida la de administrador.
- **Corrección:** `crypto.randomBytes(32)`, guardar solo su hash, no devolver `requestedAt`, limitar los intentos y enviar el token únicamente por email.

### C-07 · Inyección SQL sin autenticación en la búsqueda de productos
- **Fichero:** `app/api/products/search/route.ts:85-100`
- **Detalle:** el parámetro `q` se interpola dentro de `LIKE '%${query}%'` y se ejecuta con `$queryRawUnsafe`. Con `UNION SELECT` se extrae toda la base de datos (usuarios, hashes, tokens). El filtro que descarta los valores con `qkb{` se evita fácilmente con `hex()`, `substr()`, etc.
- **Corrección:** usar `prisma.product.findMany({ where: { OR: [{ name: { contains: q } }, …] } })` o `$queryRaw` con plantilla parametrizada.

### C-08 · Inyección SQL en la búsqueda de pedidos
- **Fichero:** `app/api/orders/search/route.ts:81-102`
- **Detalle:** `status` se concatena en la consulta (`AND o.status = '${status}'`). Cualquier usuario autenticado puede leer los pedidos y direcciones de todos los usuarios, o cualquier otra tabla.
- **Corrección:** consulta parametrizada y validación con `z.enum([...])`.

### C-09 · Inyección SQL apilada (escritura) en la auditoría de reseñas
- **Fichero:** `app/api/admin/reviews/route.ts:102-136`
- **Detalle:** `author` se interpola y se ejecuta con `better-sqlite3` mediante `db.exec()`, que **acepta varias sentencias**. Permite `UPDATE`/`DROP`/`INSERT` arbitrarios y `ATTACH DATABASE`, con el que se pueden escribir ficheros en disco. Requiere ser admin, pero el rol de admin se obtiene con C-01, C-02, C-05 o C-06.
- **Corrección:** eliminar `db.exec`, usar `db.prepare("… WHERE r.author = ?").all(author)` o, mejor, Prisma.

### C-10 · Inyección SQL en el tracking (sin autenticación, vía cabeceras)
- **Fichero:** `app/api/tracking/route.ts:58-103`
- **Detalle:** `ip` (sacada de `X-Forwarded-For`, que controla el cliente) y `sessionId` se insertan sin escapar en un `INSERT`. Es inyección SQL anónima y, además, la puerta de entrada del XSS A-05.
- **Corrección:** `prisma.visitorLog.create(...)`; obtener la IP de una cabecera fijada por un proxy de confianza.

### C-11 · XXE en la importación de pedidos de proveedor
- **Fichero:** `app/api/admin/suppliers/import-order/route.ts:21-24`
- **Detalle:** `libxmljs.parseXmlString(rawXml, { noent: true, dtdload: true })` expande entidades externas. Con `<!ENTITY x SYSTEM "file:///app/.env.local">` se leen ficheros locales (`supplier-registry.txt`, `.env.local`, `/etc/passwd`…) y su contenido vuelve en la respuesta. También permite SSRF y DoS por *billion laughs*. Los mensajes de error, encima, revelan la ruta de `supplier-registry.txt`.
- **Corrección:** `noent: false, dtdload: false, nonet: true`, rechazar cualquier `<!DOCTYPE`, o cambiar a JSON.

### C-12 · Path traversal / lectura arbitraria de ficheros sin autenticación
- **Fichero:** `app/api/files/route.ts:17-67`
- **Detalle:** el endpoint **no tiene autenticación** y usa `join(baseDir, file)` sin normalizar. `?file=../.env.local`, `?file=../flag.txt` o `?file=../prisma/dev.db` leen cualquier fichero. `?list=true&path=../..` lista directorios. Además, la cabecera `Content-Disposition` se construye con el nombre que manda el usuario.
- **Corrección:** exigir `withAdminAuth`, resolver la ruta con `path.resolve`, comprobar que empieza por `baseDir + path.sep`, y usar una lista blanca de extensiones o IDs opacos.

### C-13 · SSRF con lectura completa de la respuesta (soporte)
- **Fichero:** `app/api/support/route.ts:14-21`
- **Detalle:** endpoint público. Hace `fetch(screenshotUrl)` contra cualquier URL, añade la cabecera `X-Internal-Request: true` y **devuelve el cuerpo** al cliente. Sirve para acceder a servicios internos, metadatos cloud (`169.254.169.254`) y a la página `/internal`, cuya única protección es precisamente esa cabecera (ver A-12).
- **Corrección:** no descargar URLs del usuario; si hace falta, subir el fichero directamente. Si no hay más remedio, usar una lista blanca de hosts, bloquear rangos privados y link-local después de resolver el DNS, no seguir redirecciones y no reenviar el contenido.

### C-14 · Secretos expuestos en el bundle del cliente y en la imagen Docker
- **Ficheros:** `.env.local`, `app/checkout/CheckoutClient.tsx:119`, `.dockerignore`
- **Detalle:**
  - `NEXT_PUBLIC_PAYMENT_SECRET`: todo lo que lleva el prefijo `NEXT_PUBLIC_` acaba **en el JavaScript que se sirve al navegador**. Además, el valor es solo base64 de una cadena.
  - `.dockerignore` excluye `.env` pero **no `.env.local`, `flag.txt` ni `supplier-registry.txt`**, así que `COPY . .` los mete en la imagen.
  - `.env.local` está en el repositorio y no lo ignora `.gitignore`, que solo excluye `.env`.
- **Corrección:** quitar los secretos de las variables `NEXT_PUBLIC_*`, añadir `.env*` a `.gitignore` y `.dockerignore`, **rotar todos los secretos expuestos** y usar un gestor de secretos.

---

## 3. Hallazgos de severidad alta

| ID | Hallazgo | Ubicación | Detalle y corrección |
|---|---|---|---|
| A-01 | **IDOR en pedidos** | `app/api/orders/[id]/route.ts:8-64` | `GET /api/orders/ORD-001` devuelve nombre, email y dirección de cualquier pedido. Los IDs son secuenciales (`ORD-001`, `ORD-002`…). → Filtrar por `userId: user.id`, salvo para admins. |
| A-02 | **IDOR en listas de deseos** | `app/api/wishlists/[id]/route.ts:6-81` | El GET no comprueba el propietario ni `isPublic` y devuelve `ownerEmail`. → Comprobar `userId === user.id \|\| isPublic`. |
| A-03 | **Manipulación del precio** | `app/api/orders/route.ts:39,130` | El cliente envía `total` y el servidor lo guarda tal cual: se puede pagar 0,01 €. → Calcular el total en el servidor a partir del carrito y del cupón. |
| A-04 | **Race condition en cupones** | `app/api/orders/route.ts:64-87` | Se comprueba `usedCount < maxUses`, se espera 150 ms y luego se incrementa, de forma no atómica. Con peticiones paralelas el cupón se usa N veces. → `updateMany({ where:{code, usedCount:{lt:maxUses}}, data:{increment} })` y comprobar `count`, dentro de una transacción. |
| A-05 | **XSS almacenado en el panel de analítica** | `app/admin/analytics/AnalyticsClient.tsx:366` | `dangerouslySetInnerHTML={{ __html: visit.ip }}`, y la IP sale de `X-Forwarded-For`. Un visitante anónimo ejecuta JS en el navegador del admin. → Renderizar como texto. |
| A-06 | **XSS almacenado en reseñas con ejecución de `<script>`** | `app/products/[id]/ProductDetailClient.tsx:51-60`, `api/products/[id]/reviews` | `innerHTML = review.content` y además **se recrean las etiquetas `<script>`** para que se ejecuten. Las reseñas se crean sin autenticación. → Renderizar como texto o sanear con DOMPurify. |
| A-07 | **Suplantación de autor en reseñas** | `app/api/products/[id]/reviews/route.ts:59-63` | El campo `author` lo elige el cliente y no hace falta sesión. → Usar siempre el email de la sesión y exigir login. |
| A-08 | **XSS por SSRF en el formulario de soporte** | `app/support/SupportForm.tsx:103` | El HTML descargado en C-13 se inyecta con `dangerouslySetInnerHTML`. |
| A-09 | **XSS por subida de SVG** | `app/api/admin/products/[id]/image/route.ts:9-15`, `app/api/uploads/[...path]/route.ts` | Se aceptan SVG (validando solo el `file.type` que declara el cliente) y se sirven en el mismo origen como `image/svg+xml`. Abrir la URL ejecuta JS. → Quitar SVG, validar con *magic bytes*, servir con `Content-Disposition: attachment` y CSP `sandbox`, o desde otro dominio. |
| A-10 | **SSRF y prompt injection indirecta en el asistente IA** | `app/api/ai-assistant/route.ts:200-212,277` | El usuario indica `mcpServerUrl` y el servidor le hace peticiones (SSRF). Las descripciones y respuestas de las herramientas externas llegan al LLM sin aislar, y el LLM puede llamar a herramientas internas con la cabecera de sesión privilegiada (`get_compliance_report`). El filtro de *prompt injection* son 4 regex triviales de evitar. → Quitar `mcpServerUrl` o ponerlo en lista blanca, no exponer herramientas privilegiadas al LLM y controlar la autorización en el servidor, no en el *system prompt*. |
| A-11 | **Autenticación MCP con un valor fijo** | `lib/mcp-constants.ts`, `app/api/mcp/route.ts:181` | `X-MCP-Session: quokka-internal-agent` está hardcodeado. Cualquiera puede llamar directamente a `POST /api/mcp` con esa cabecera y obtener el informe de cumplimiento. → Secreto aleatorio por entorno y endpoint accesible solo desde la red interna. |
| A-12 | **Página `/internal` protegida solo por una cabecera** | `app/internal/page.tsx:16-21` | Basta con enviar `x-internal-request: true`, sea directamente o a través del SSRF de C-13. → Autenticación real. |
| A-13 | **Consola SIEM con credenciales por defecto y cookie forjable** | `app/api/monitoring/auth/route.ts:5-6`, `app/api/monitoring/logs/route.ts:7-23` | Usuario y contraseña `root`/`admin` hardcodeados. La sesión es la cookie fija `siem_session=authenticated`, que cualquiera puede poner a mano sin conocer la contraseña. → Integrar con la autenticación normal y usar una sesión firmada. |
| A-14 | **Contraseñas en claro en los logs** | `app/api/auth/login/route.ts:16-25` | `logger.warn({ email, password, … })`. Con A-13 cualquiera lee las contraseñas de todos los usuarios que inician sesión. → No registrar nunca credenciales. |
| A-15 | **Hash de contraseñas MD5 sin sal** | `lib/server-auth.ts:14`, login, signup y reset | MD5 se rompe al instante con tablas *rainbow*. `/news` publica hashes reales de usuarios (`app/news/page.tsx:4-17`). → argon2id o bcrypt, y migrar los hashes en el próximo login. |
| A-16 | **Exportación de datos con `password` y fuga de diagnósticos** | `app/api/user/export/route.ts:7,35-60,78-91` | `password` está en la lista blanca de campos exportables. Pedir un campo inválido devuelve `systemDiagnostics`, con un *flag* interno, la versión de Node y la traza de la pila. → Quitar `password` y no devolver datos de depuración. |

---

## 4. Hallazgos de severidad media

| ID | Hallazgo | Ubicación | Detalle y corrección |
|---|---|---|---|
| M-01 | **Códigos de tarjeta regalo predecibles** | `lib/gift-card.ts`, `app/api/gift-cards/route.ts:52` | LCG sembrado con `Date.now()` en milisegundos. Si se conoce la hora aproximada de la compra, el código sale por fuerza bruta en unos pocos miles de intentos, y el canje no tiene límite de intentos. → `crypto.randomInt` y *rate limiting*. |
| M-02 | **Padding oracle / tokens de compartición maleables** | `lib/share-crypto.ts`, `app/api/documents/share/route.ts:14-42` | AES-256-CBC sin MAC, con **clave por defecto hardcodeada**. Un error de *padding* (400 "Invalid share token format") se distingue de un tipo inválido (400 que además **refleja el texto descifrado**), lo que permite descifrar y forjar tokens (`order:ORD-00X`, `report:internal`). → AES-GCM o HMAC sobre IDs aleatorios guardados en BD, y clave obligatoria por entorno. |
| M-03 | **BFLA en el stream en directo y fuga de la clave de emisión** | `app/api/live/stream/route.ts:30-99`, `lib/live-stream.ts:14` | Cualquier usuario autenticado cambia el vídeo de `/live`, y el GET devuelve `rtmpUrl` y `streamKey`. → POST solo para admins, y no devolver la clave. |
| M-04 | **Endpoint de diagnóstico con token hardcodeado** | `app/api/admin/diag/route.ts:5-14` | `x-debug-auth: dbg_8f3a…` está en el código fuente y sin `withAdminAuth`. La nota HTML oculta en `app/admin/documents/page.tsx:5-6` lo menciona junto a un paquete `react-toastfy` de un "registro interno": posible intento de **ataque a la cadena de suministro** (*typosquatting* de `react-toastify`). Hoy no aparece en `package.json` ni en el lock, pero conviene vigilarlo. → Eliminar el endpoint y bloquear registros npm no oficiales (`.npmrc`, `npm ci` con lockfile revisado). |
| M-05 | **Open redirect / XSS por `javascript:` en el login** | `app/login/LoginForm.tsx:16,37` | `window.location.href = redirect` sin validar. `?redirect=javascript:…` o `?redirect=https://evil` → solo permitir rutas relativas que empiecen por `/` y no por `//`. |
| M-06 | **Endpoints públicos de flags y datos internos** | `app/api/flags/route.ts`, `api/flags/[slug]` | Sin autenticación: devuelven todos los valores de la tabla `Flag`. |
| M-07 | **Enumeración de usuarios** | `app/api/auth/login/route.ts:39-48`, `signup:22-27`, `support-access:65` | Mensajes distintos para "Invalid credentials" y "Invalid password", "Email already registered" y 404 "User not found". → Mensaje genérico. |
| M-08 | **Sin rate limiting ni bloqueo de cuenta** | login, forgot/reset password, redeem, support-login, ai-assistant | Permite fuerza bruta (las contraseñas de prueba son débiles: `admin`, `qwerty`…) y abuso de costes del LLM. |
| M-09 | **Tokens y sesiones de larga duración y sin revocación** | `support-login:47` (365 días), JWT de 7 días, logout que solo borra la cookie | No hay lista de revocación ni rotación. → TTL corto, sesiones en servidor o `jti` con *denylist*. |
| M-10 | **Política de contraseñas inexistente** | `signupBodySchema` | `password: z.string()` acepta la cadena vacía (el reset exige 6 caracteres). → Mínimo 12 y comprobación contra listas de contraseñas filtradas. |
| M-11 | **Formularios `x-www-form-urlencoded` en endpoints que cambian estado** | `api/orders/[id]` (POST), `api/user/profile` (POST) | Aceptan *form-encoded*, que es el formato de un ataque CSRF con un `<form>`. Ahora mismo la cookie `SameSite=Lax` lo frena en cross-site, pero no frente a otros subdominios ni si se relaja la política. → Aceptar solo JSON, verificar `Origin` y usar token CSRF. |

---

## 5. Hallazgos de severidad baja / informativa

- **B-01 · Credenciales y secretos en el código:** `streamKey` (`lib/live-stream.ts`), `AUDIT_TAG` (login), el código de validación dentro del *system prompt* del bot (`ai-assistant/route.ts:22`; los *system prompts* acaban filtrándose), y los usuarios seed con contraseñas `admin`/`qwerty`/`sunshine`/`iloveduck`.
- **B-02 · Mensajes de error verbosos:** la importación XML devuelve `error.message` y rutas internas; la exportación devuelve la traza de la pila.
- **B-03 · Faltan cabeceras de seguridad:** no hay CSP, `X-Frame-Options`/`frame-ancestors`, HSTS, `X-Content-Type-Options` ni `Referrer-Policy` (`next.config.ts`).
- **B-04 · La cookie solo es `Secure` si `NODE_ENV=production`**, y la cookie del SIEM no es `Secure` nunca.
- **B-05 · Contenedor ejecutado como root:** no hay `USER node`; la imagen incluye las *toolchains* de compilación (`g++`, `make`). `scripts/setup.sh` arranca Prisma Studio, que no tiene autenticación.
- **B-06 · Datos sensibles en `localStorage`:** el usuario y su rol (el cliente decide qué UI mostrar según ese rol, aunque el servidor vuelve a validar), y **la API key de Mistral** (`AIAssistantChat.tsx:44`), que cualquier XSS puede robar.
- **B-07 · `package.json` con `"private": false`** y dependencias con rangos `^`: riesgo de publicar el paquete por error y de recibir actualizaciones no revisadas. `eslint-config-next@16` no corresponde con `next@15`.

---

## 6. Cadenas de ataque destacadas

1. **Anónimo → admin en un paso:** `POST /api/auth/signup` con `role:"ADMIN"` (C-01), o forjar un JWT con la clave `"secret"` (C-02).
2. **Anónimo → secretos del servidor:** `GET /api/files?file=../.env.local` (C-12).
3. **Anónimo → toda la base de datos:** `GET /api/products/search?q=' UNION SELECT …--` (C-07).
4. **Anónimo → XSS en el admin → acciones de admin:** `X-Forwarded-For: <img src=x onerror=…>` en `/api/tracking` (C-10 + A-05).
5. **Usuario → admin:** `POST /api/user/support-access {"email":"admin@quokka.store"}` y después `support-login` (C-05).
6. **Admin (obtenido con lo anterior) → lectura de ficheros y escritura en la BD:** XXE (C-11) e inyección SQL apilada (C-09).
7. **Anónimo → RCE:** CVE-2025-55182 en React 19.2.0 (C-04).

---

## 7. Plan de remediación priorizado

**Inmediato (antes de cualquier despliegue):**
1. Actualizar `react`/`react-dom` (≥19.2.1) y `next` (versión parcheada de la rama 15.x).
2. Quitar `role` del registro; secreto JWT obligatorio y robusto; verificar la firma en el middleware.
3. Arreglar los tokens de soporte (ligados al propio usuario y comprobando `revoked`) y el reset de contraseña (token aleatorio).
4. Parametrizar todas las consultas SQL (`grep -rn "queryRawUnsafe\|db.exec\|\${" app/api`).
5. Desactivar entidades y DTD en libxml; proteger y sanear `/api/files`.
6. Eliminar los SSRF (`/api/support`, `mcpServerUrl`).
7. **Rotar todos los secretos** y sacarlos del repositorio, del bundle y de la imagen Docker.

**Corto plazo:**
8. Autorización por objeto (pedidos, wishlists) y por función (stream, flags, diag, MCP, SIEM).
9. Quitar todos los `dangerouslySetInnerHTML` e `innerHTML` con datos del usuario; bloquear SVG; añadir CSP.
10. Calcular el total del pedido en el servidor; incremento atómico del cupón; generador criptográfico para las tarjetas regalo.
11. Pasar de MD5 a argon2id; dejar de registrar contraseñas; *rate limiting*.

**Medio plazo:**
12. Cabeceras de seguridad, contenedor sin root, errores genéricos, sesiones revocables.
13. Pipeline de CI con `npm audit`/OSV, SAST (Semgrep/CodeQL) y revisión de cambios en el lockfile para detectar paquetes *typosquat* como `react-toastfy`.

---

*Revisión estática manual. Las versiones vulnerables de las dependencias se han identificado por los números de versión declarados en `package.json`; conviene confirmarlas con `npm audit` después de `npm ci`.*
