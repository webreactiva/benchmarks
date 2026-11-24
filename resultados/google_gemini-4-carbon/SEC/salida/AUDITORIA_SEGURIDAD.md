# Informe de Auditoría de Seguridad — Quokka Bazaar (`v2.17.0`)

- **Proyecto auditado:** `quokka-bazaar` (`v2.17.0`)
- **Stack tecnológico:** Next.js `15.2.2` (App Router), React `19.2.0`, TypeScript, Prisma ORM `6.19.1`, SQLite (`better-sqlite3` `12.6.2`), `libxmljs2` `0.37.0`, `pdf-lib` `1.17.1`, `pino` `10.3.1`, Zod `4.4.1`, Docker.
- **Fecha de auditoría:** 24 de noviembre de 2026
- **Alcance:** Revisión estática integral de código fuente (SAST), arquitectura de autenticación y autorización, criptografía, lógica de negocio, integraciones de IA/MCP, dependencias (SCA) y configuración de despliegue/contenedores.

---

## 1. Resumen Ejecutivo

Durante la auditoría de seguridad de **Quokka Bazaar** se identificaron **22 hallazgos de seguridad** distribuidos en todos los niveles de la aplicación: desde vulnerabilidades críticas en versiones de dependencias base (ejecución remota de código y evasión de middleware) e inyecciones en el servidor (SQLi, XXE, Path Traversal y SSRF), hasta fallos graves de control de acceso (escalada de privilegios a administrador, toma de control de cuentas e IDOR), debilidades criptográficas (MD5 sin sal, claves hardcodeadas, Padding Oracle en AES-CBC y PRNG predecible) y riesgos en la integración con modelos de lenguaje y servidores MCP.

> **Nota contextual:** El propio pie de página de la aplicación (`app/components/Footer.tsx:18-21`) describe el repositorio como una plataforma diseñada con fines educativos y de entrenamiento en seguridad web. Si cualquier parte de este código pretende reutilizarse como base para un entorno real o exponerse en red, **no debe desplegarse en su estado actual** hasta corregir la totalidad de los hallazgos críticos y altos detallados a continuación.

### Resumen Cuantitativo por Severidad

| Severidad | Cantidad | Áreas Principales Afectadas |
| :--- | :---: | :--- |
| **Crítica** | 8 | Dependencias (Next.js / React), SQL Injection (x4), Escalada a `ADMIN` por Mass Assignment, Account Takeover por tokens de soporte, Path Traversal sin autenticación, XXE, SSRF + cabecera interna, Secretos/Verificación JWT |
| **Alta** | 7 | Contraseñas en MD5 y en logs + SIEM con credenciales por defecto, Reset de contraseña predecible, Manipulación de precios y Race Condition en cupones, IDOR / BFLA en pedidos, wishlists y streaming, XSS almacenado/DOM/SVG, Padding Oracle AES-CBC + PRNG LCG en Gift Cards, Prompt Injection + MCP SSRF/Tool Poisoning |
| **Media** | 4 | CSRF y formularios URL-encoded / GET login, Exposición de secretos `NEXT_PUBLIC_` y endpoints de diagnóstico/flags, Host Header Injection, Enumeración de usuarios y ausencia de Rate Limiting |
| **Baja** | 3 | Contenedor Docker ejecutado como `root` y `.env.local` no ignorado, Ausencia de cabeceras HTTP de seguridad (CSP, HSTS, X-Frame-Options), Exposición de Prisma Studio sin autenticación en `scripts/setup.sh` |
| **Total** | **22** | |

---

## 2. Matriz de Hallazgos

| ID | Severidad | Título del Hallazgo | CWE | OWASP | Ubicación Principal |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **SEC-01** | Crítica | Vulnerabilidades críticas conocidas en Next.js y React (RCE y evasión de Middleware) | CWE-502, CWE-287 | A06:2021 | `package.json:33,37-38`, `middleware.ts:37-39` |
| **SEC-02** | Crítica | Inyección SQL (SQLi) múltiple y consultas apiladas (*Stacked Queries*) | CWE-89 | A03:2021 | `app/api/products/search/route.ts:85-103`, `app/api/tracking/route.ts:97-103`, `app/api/orders/search/route.ts:81-105`, `app/api/admin/reviews/route.ts:103-136` |
| **SEC-03** | Crítica | Asignación masiva (*Mass Assignment*) permite registro directo como `ADMIN` | CWE-915, CWE-269 | A01:2021 | `app/api/auth/signup/route.ts:59-61`, `lib/validation/schemas/auth.ts:3-9` |
| **SEC-04** | Crítica | Toma de control de cuentas (*Account Takeover*) vía generación arbitraria de tokens de soporte y omisión de estado revocado | CWE-639, CWE-613 | A01:2021, A07:2021 | `app/api/user/support-access/route.ts:58-91`, `app/api/auth/support-login/route.ts:15-49` |
| **SEC-05** | Crítica | Lectura arbitraria de archivos y listado de directorios sin autenticación (*Path Traversal*) | CWE-22, CWE-306 | A01:2021 | `app/api/files/route.ts:8-67` |
| **SEC-06** | Crítica | Inyección de Entidades Externas XML (XXE) en importación de pedidos de proveedores | CWE-611 | A05:2021 | `app/api/admin/suppliers/import-order/route.ts:21-24` |
| **SEC-07** | Crítica | SSRF no autenticado con inyección de cabecera interna privilegiada y control de acceso por cabecera falsificable | CWE-918, CWE-290 | A10:2021, A01:2021 | `app/api/support/route.ts:14-28`, `app/internal/page.tsx:16-21` |
| **SEC-08** | Crítica | Secreto JWT trivial por defecto y omisión total de verificación de firma en Middleware | CWE-798, CWE-347 | A02:2021, A07:2021 | `lib/server-auth.ts:12,31-57`, `middleware.ts:3-35` |
| **SEC-09** | Alta | Hashing de contraseñas con MD5 sin sal, registro de contraseñas en texto plano y SIEM con credenciales por defecto | CWE-328, CWE-532, CWE-798 | A02:2021, A09:2021 | `lib/server-auth.ts:14-16`, `app/api/auth/login/route.ts:16-25`, `app/api/monitoring/auth/route.ts:5-22`, `app/news/page.tsx:4-17` |
| **SEC-10** | Alta | Tokens predecibles de recuperación de contraseña con filtración de marca temporal exacta | CWE-330, CWE-640 | A02:2021, A07:2021 | `app/api/auth/forgot-password/route.ts:13-43` |
| **SEC-11** | Alta | Manipulación del importe total de compra y condición de carrera (*TOCTOU*) en uso de cupones | CWE-472, CWE-362 | A04:2021 | `app/api/orders/route.ts:39,64-88,113-137` |
| **SEC-12** | Alta | Control de acceso roto (IDOR / BOLA y BFLA) en pedidos, listas de deseos y retransmisión en vivo | CWE-639, CWE-285 | A01:2021 | `app/api/orders/[id]/route.ts:8-64`, `app/api/wishlists/[id]/route.ts:6-82`, `app/api/live/stream/route.ts:30-100` |
| **SEC-13** | Alta | Cross-Site Scripting (XSS) almacenado, reflejado, basado en DOM y mediante carga de SVG | CWE-79, CWE-601 | A03:2021 | `app/products/[id]/ProductDetailClient.tsx:51-67`, `app/admin/analytics/AnalyticsClient.tsx:364-367`, `app/support/SupportForm.tsx:103-105`, `app/login/LoginForm.tsx:36-37`, `app/api/uploads/[...path]/route.ts:12` |
| **SEC-14** | Alta | Oráculo de relleno (*Padding Oracle*) y maleabilidad AES-CBC en enlaces compartidos + PRNG predecible en tarjetas de regalo | CWE-327, CWE-209, CWE-338 | A02:2021 | `lib/share-crypto.ts:3-32`, `app/api/documents/share/route.ts:13-42`, `lib/gift-card.ts:5-25`, `app/api/gift-cards/route.ts:51-52` |
| **SEC-15** | Alta | Inyección de prompts, SSRF/envenenamiento de herramientas MCP externas y autenticación MCP estática | CWE-77, CWE-918, CWE-287 | LLM01, LLM02, LLM07 | `app/api/ai-assistant/route.ts:8-34,167-212`, `lib/prompt-injection-filter.ts:1-9`, `app/api/mcp/route.ts:181-182` |
| **SEC-16** | Media | Ausencia de protección contra CSRF en endpoints mutables con soporte `application/x-www-form-urlencoded` y Login vía `GET` | CWE-352 | A01:2021 | `app/api/user/profile/route.ts:60-66`, `app/api/orders/[id]/route.ts:87-91,182-185`, `app/api/auth/support-login/route.ts:8` |
| **SEC-17** | Media | Exposición de secretos en cliente (`NEXT_PUBLIC_`), endpoint de diagnóstico hardcodeado, filtración de diagnósticos y riesgo de cadena de suministro | CWE-200, CWE-209, CWE-489 | A05:2021, A08:2021 | `.env.local:1`, `app/checkout/CheckoutClient.tsx:119`, `app/api/admin/diag/route.ts:5-25`, `app/api/user/export/route.ts:35-92`, `app/api/flags/route.ts:5-14` |
| **SEC-18** | Media | Inyección de cabecera `Host` en generación de enlaces de compartición | CWE-644 | A05:2021 | `app/api/orders/[id]/share/route.ts:21-23` |
| **SEC-19** | Media | Ausencia global de limitación de tasa (*Rate Limiting*) y enumeración de cuentas | CWE-307, CWE-204 | A07:2021 | `app/api/auth/login/route.ts:39-48`, `app/api/auth/signup/route.ts:22-27`, `app/api/gift-cards/redeem/route.ts:24` |
| **SEC-20** | Baja | Ejecución de contenedor Docker como `root`, herramientas de compilación en producción e inclusión de `.env.local` | CWE-250, CWE-538 | A05:2021 | `Dockerfile:1-34`, `.dockerignore:1-24`, `.gitignore:37` |
| **SEC-21** | Baja | Ausencia de cabeceras de seguridad HTTP (CSP, HSTS, X-Content-Type-Options, Frame-Ancestors) | CWE-693 | A05:2021 | `next.config.ts:1-19` |
| **SEC-22** | Baja | Apertura automática de Prisma Studio sin autenticación en script de arranque | CWE-306 | A05:2021 | `scripts/setup.sh:53-54` |

---

## 3. Análisis Detallado de Hallazgos y Recomendaciones

---

### Hallazgos de Severidad Crítica

#### SEC-01 — Vulnerabilidades Críticas Conocidas en Next.js y React (RCE y Evasión de Middleware)
- **Severidad:** Crítica
- **Clasificación:** CWE-502 (Deserialization of Untrusted Data), CWE-287 (Improper Authentication) | OWASP A06:2021 (Vulnerable and Outdated Components)
- **Ubicación:** `package.json:33,37-38`, `middleware.ts:37-39`
- **Descripción técnica:**
  El proyecto fija versiones exactas con vulnerabilidades críticas públicas:
  1. **CVE-2025-55182 (`react@19.2.0`, `react-dom@19.2.0`, `next@15.2.2`):** Fallo de deserialización insegura en el protocolo Flight de React Server Components que permite ejecución remota de código (RCE) en el servidor sin requerir autenticación previa.
  2. **CVE-2025-29927 (`next@15.2.2`):** Las versiones de Next.js de la rama 15.x anteriores a `15.2.3` permiten omitir por completo la ejecución de `middleware.ts` cuando una solicitud incluye la cabecera interna `x-middleware-subrequest`. Dado que la ruta restringida `/monitoring/internal-status` (`app/monitoring/internal-status/page.tsx`) delega toda su autorización exclusivamente a `middleware.ts` sin validar la sesión dentro del propio Server Component, cualquier restricción perimetral del middleware queda neutralizada.
- **Impacto:** Compromiso total del servidor subyacente mediante RCE y acceso no autenticado a vistas protegidas únicamente por el middleware de Next.js.
- **Remediación:**
  - Actualizar inmediatamente `next` a la última versión parcheada disponible (`>= 15.2.6` / última versión estable de mantenimiento) y `react` / `react-dom` a versiones parcheadas contra CVE-2025-55182 (`>= 19.2.1+`).
  - Aplicar defensa en profundidad verificando la sesión y el rol dentro de cada Server Component o capa de acceso a datos (*Data Access Layer*), sin depender únicamente de `middleware.ts`.

---

#### SEC-02 — Inyección SQL (SQLi) Múltiple y Ejecución de Sentencias Apiladas (*Stacked Queries*)
- **Severidad:** Crítica
- **Clasificación:** CWE-89 (SQL Injection) | OWASP A03:2021 (Injection)
- **Ubicación:**
  1. `app/api/products/search/route.ts:85-103` (endpoint público)
  2. `app/api/tracking/route.ts:58-59,97-103` (endpoint público)
  3. `app/api/orders/search/route.ts:81-105` (endpoint autenticado)
  4. `app/api/admin/reviews/route.ts:103-136` (endpoint administrativo)
- **Descripción técnica:**
  Cuatro rutas construyen sentencias SQL concatenando directamente cadenas controladas por el usuario en lugar de emplear consultas parametrizadas o la API tipada de Prisma:
  - En `app/api/products/search/route.ts:93`, el parámetro `q` se interpola directamente dentro de `WHERE name LIKE '%${query}%' OR description LIKE '%${query}%'` y se ejecuta con `prisma.$queryRawUnsafe(sqlQuery)`.
  - En `app/api/tracking/route.ts:58-59,99`, los valores de las cabeceras HTTP `x-forwarded-for` / `x-real-ip` (`ip`) y el campo `sessionId` se interpolan sin parametrizar ni escapar en una sentencia `INSERT INTO visitor_logs ...` mediante `prisma.$queryRawUnsafe(query)`.
  - En `app/api/orders/search/route.ts:81,96`, el campo `status` del cuerpo JSON se interpola directamente en `AND o.status = '${status}'` mediante `prisma.$queryRawUnsafe(query)`.
  - En `app/api/admin/reviews/route.ts:113,120`, el parámetro `author` se interpola en `WHERE r.author = '${authorFilter}'` y se ejecuta mediante `db.exec(query)` de `better-sqlite3`. A diferencia de una consulta preparada individual, `db.exec()` ejecuta **múltiples sentencias SQL separadas por punto y coma**, permitiendo escrituras, alteración de roles de usuarios o borrado de tablas.
  - Adicionalmente, los filtros de salida posteriores que intentan ocultar cadenas específicas (`value.toLowerCase().includes(...)`) son ineficaces ante transformaciones SQL de subcadenas o codificaciones (p. ej., `HEX()`/`SUBSTR()`).
- **Impacto:** Extracción completa de la base de datos (usuarios, hashes de contraseñas, tokens de acceso y pedidos de todos los clientes) desde endpoints no autenticados, así como modificación arbitraria de registros en SQLite.
- **Remediación:**
  - Eliminar todas las llamadas a `prisma.$queryRawUnsafe()` y `better-sqlite3` `db.exec()`.
  - Utilizar las operaciones nativas tipadas de Prisma (`prisma.product.findMany`, `prisma.visitorLog.create`, `prisma.order.findMany`, `prisma.review.findMany`) o, si fuera imprescindible SQL crudo, plantillas etiquetadas parametrizadas `prisma.$queryRaw\`...\``.

  ```ts
  // Ejemplo seguro para app/api/products/search/route.ts
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: query } },
        { description: { contains: query } },
      ],
    },
    orderBy: { name: "asc" },
    take: 50,
  });
  ```

---

#### SEC-03 — Asignación Masiva (*Mass Assignment*) Permite Escalada Directa a `ADMIN` en el Registro
- **Severidad:** Crítica
- **Clasificación:** CWE-915 (Improperly Controlled Modification of Dynamically-Determined Object Attributes), CWE-269 (Improper Privilege Management) | OWASP A01:2021 (Broken Access Control)
- **Ubicación:** `lib/validation/schemas/auth.ts:3-9`, `app/api/auth/signup/route.ts:59-61`
- **Descripción técnica:**
  El esquema de validación `signupBodySchema` declara explícitamente `role: z.string().optional()` junto con `.passthrough()`, y el controlador de registro asigna directamente dicho atributo al nuevo usuario antes de persistirlo y emitir el JWT:
  ```ts
  if (body.role) {
    userData.role = body.role as UserRole;
  }
  ```
- **Impacto:** Cualquier visitante anónimo puede crear una cuenta con privilegios administrativos completos (`ADMIN`), obteniendo acceso inmediato a todos los endpoints administrativos (`/api/admin/*`, gestión de pedidos, importación XML, subida de imágenes, analíticas y auditoría).
- **Remediación:**
  - Eliminar la propiedad `role` y `.passthrough()` de `signupBodySchema` en `lib/validation/schemas/auth.ts`.
  - Forzar siempre el rol `UserRole.CUSTOMER` en el servidor durante el autorregistro (`app/api/auth/signup/route.ts`), restringiendo cualquier promoción de privilegios a un flujo administrativo autenticado y auditado.

---

#### SEC-04 — Toma de Control de Cuentas (*Account Takeover*) en el Sistema de Acceso de Soporte
- **Severidad:** Crítica
- **Clasificación:** CWE-639 (Authorization Bypass Through User-Controlled Key), CWE-613 (Insufficient Session Expiration) | OWASP A01:2021, A07:2021
- **Ubicación:** `app/api/user/support-access/route.ts:51-91`, `lib/validation/schemas/user.ts:15-19`, `app/api/auth/support-login/route.ts:15-50`
- **Descripción técnica:**
  Se combinan tres fallos graves en el mecanismo de delegación de soporte:
  1. **Generación de tokens para terceros:** En `POST /api/user/support-access` (`route.ts:58`), el servidor ejecuta `const targetEmail = parsed.data?.email || user.email;`, buscando en base de datos cualquier cuenta coincidente con `targetEmail` sin verificar que pertenezca al usuario autenticado, y devuelve el token en claro (`supportToken.token`) y la URL de acceso directo en la respuesta HTTP.
  2. **Ignorancia de la revocación:** En `GET /api/auth/support-login` (`route.ts:15-40`), se valida la existencia y fecha de expiración del token (`supportToken.expiresAt`), pero **nunca se comprueba `if (supportToken.revoked)`**, haciendo inútil el botón de revocación del perfil (`DELETE /api/user/support-access`).
  3. **Duración excesiva y reutilización indefinida:** Tanto el token de soporte como el JWT resultante se emiten con una validez de **365 días** (`route.ts:47`), no son de un solo uso y el inicio de sesión se ejecuta mediante una petición `GET` (exponiendo el secreto en historiales, cabeceras `Referer` y logs HTTP).
- **Impacto:** Cualquier usuario registrado puede tomar el control inmediato y persistente de cualquier otra cuenta del sistema (incluyendo cuentas `ADMIN`) con solo conocer su dirección de correo electrónico.
- **Remediación:**
  - Eliminar el parámetro `email` de `createSupportAccessBodySchema` y vincular exclusivamente la creación del token a `user.id`.
  - Verificar obligatoriamente `supportToken.revoked === false` en `/api/auth/support-login`, marcar el token como usado tras el canje, cambiar el método a `POST` y reducir la validez a una ventana corta (p. ej., 15–60 minutos) restringida únicamente a personal de soporte autenticado.

---

#### SEC-05 — Lectura Arbitraria de Archivos y Listado de Directorios sin Autenticación (*Path Traversal*)
- **Severidad:** Crítica
- **Clasificación:** CWE-22 (Path Traversal), CWE-306 (Missing Authentication for Critical Function) | OWASP A01:2021 (Broken Access Control)
- **Ubicación:** `app/api/files/route.ts:8-67`
- **Descripción técnica:**
  Aunque la interfaz gráfica `/admin/documents` verifica en cliente el acceso a `/api/admin`, el endpoint subyacente `GET /api/files` **no utiliza `withAdminAuth` ni `withAuth`**, quedando expuesto públicamente. Además, construye rutas en disco mediante `join(baseDir, dirPath)` (línea 20) y `join(baseDir, file)` (línea 49) sin normalizar ni comprobar que la ruta canónica resultante resida dentro de `baseDir` (`documents/`). En Node.js, `path.join` resuelve secuencias relativas `..`, permitiendo escapar hacia la raíz del sistema de archivos.
- **Impacto:** Un atacante no autenticado puede enumerar directorios del servidor y descargar archivos arbitrarios como `.env.local`, la base de datos SQLite completa (`prisma/dev.db` o `/app/data/dev.db`), registros de aplicación (`logs/app.log` con contraseñas en claro), facturas PDF privadas de clientes y archivos del sistema operativo.
- **Remediación:**
  - Proteger `GET /api/files` con `withAdminAuth`.
  - Resolver rutas mediante `path.resolve` y `fs.realpath`, verificando estrictamente el prefijo del directorio base antes de acceder al sistema de archivos:
  ```ts
  const resolvedBase = path.resolve(process.cwd(), "documents");
  const resolvedTarget = path.resolve(resolvedBase, requestedPath);
  if (
    resolvedTarget !== resolvedBase &&
    !resolvedTarget.startsWith(resolvedBase + path.sep)
  ) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  ```

---

#### SEC-06 — Inyección de Entidades Externas XML (XXE) en Importación de Pedidos
- **Severidad:** Crítica
- **Clasificación:** CWE-611 (Improper Restriction of XML External Entity Reference) | OWASP A05:2021 (Security Misconfiguration)
- **Ubicación:** `app/api/admin/suppliers/import-order/route.ts:21-24,31-35,53-58`
- **Descripción técnica:**
  El endpoint administrativo de importación XML analiza la entrada cruda mediante `libxmljs2` activando de forma explícita la carga de DTD externas y la expansión de entidades:
  ```ts
  const doc = libxmljs.parseXmlString(rawXml, {
    noent: true,
    dtdload: true,
  });
  ```
  Adicionalmente, las respuestas de error devuelven un objeto `debug` que revela rutas absolutas internas del servidor (`SUPPLIER_REGISTRY_PATH`).
- **Impacto:** Lectura de archivos arbitrarios del servidor, falsificación de solicitudes del lado del servidor (SSRF) desde el analizador XML y denegación de servicio por expansión recursiva de entidades (*Billion Laughs*). Combinado con **SEC-03**, **SEC-04** o **SEC-08**, es alcanzable incluso por un atacante inicialmente no autenticado.
- **Remediación:**
  - Deshabilitar por completo la resolución de entidades externas y carga de DTD (`noent: false, dtdload: false, nonet: true`), o preferiblemente reemplazar `libxmljs2` (librería nativa en C con amplio historial de CVEs de memoria) por un parser XML puro en JavaScript que no procese entidades externas por defecto (como `fast-xml-parser`) o migrar el intercambio de datos a JSON validado con Zod.
  - Eliminar la propiedad `debug` de las respuestas de error HTTP.

---

#### SEC-07 — SSRF No Autenticado con Cabecera Privilegiada y Autorización Basada en Cabecera Falsificable
- **Severidad:** Crítica
- **Clasificación:** CWE-918 (Server-Side Request Forgery), CWE-290 (Authentication Bypass by Spoofing) | OWASP A10:2021 (SSRF), A01:2021
- **Ubicación:** `app/api/support/route.ts:14-38`, `app/internal/page.tsx:16-21`
- **Descripción técnica:**
  1. `POST /api/support` es un endpoint público que recibe `screenshotUrl` y ejecuta `fetch(screenshotUrl, { headers: { "X-Internal-Request": "true" } })` sin validar el esquema, el dominio de destino ni bloquear rangos de direcciones IP privadas, loopback (`127.0.0.1`, `localhost`, `::1`) o servicios de metadatos cloud (`169.254.169.254`). Además, retorna el texto completo de la respuesta HTTP al cliente en `data.screenshotContent`.
  2. Por su parte, `app/internal/page.tsx:17-21` autoriza el acceso al panel interno verificando únicamente `headersList.get("x-internal-request") === "true"`. Esta cabecera no solo es inyectada automáticamente por el SSRF de `/api/support`, sino que también puede ser enviada directamente desde cualquier cliente externo si el proxy inverso no la filtra.
- **Impacto:** Exploración de servicios en la red interna del contenedor/host, lectura de endpoints de metadatos de infraestructura en la nube y evasión directa del control de acceso de `/internal`.
- **Remediación:**
  - Si se requiere adjuntar capturas en soporte, procesar subidas de archivos binarios validados en lugar de descargar URLs remotas desde el servidor. Si fuera imprescindible descargar URLs externas, validar esquema `https:`, aplicar lista blanca de dominios o resolver DNS verificando que ninguna IP resuelta pertenezca a rangos privados/reservados (RFC 1918, RFC 4193, loopback, link-local), deshabilitar redirecciones (`redirect: "error"`) y no devolver el cuerpo crudo ni adjuntar cabeceras internas.
  - Sustituir la comprobación de `x-internal-request` en `app/internal/page.tsx` por autenticación y autorización real basada en sesión de servidor (`ADMIN`).

---

#### SEC-08 — Secreto JWT Trivial por Defecto y Omisión de Verificación de Firma en Middleware
- **Severidad:** Crítica
- **Clasificación:** CWE-798 (Use of Hard-coded Credentials), CWE-347 (Improper Verification of Cryptographic Signature) | OWASP A02:2021, A07:2021
- **Ubicación:** `lib/server-auth.ts:12,31-57`, `middleware.ts:3-35`
- **Descripción técnica:**
  1. En `lib/server-auth.ts:12`, la clave de firma HMAC-SHA256 de sesiones se define como `const JWT_SECRET = process.env.JWT_SECRET || "secret";`. Ni `docker-compose.yml`, ni `Dockerfile`, ni `.env.local`, ni `scripts/setup.sh` definen `JWT_SECRET`, por lo que la aplicación opera en producción firmando todos los tokens de sesión con la cadena literal `"secret"`.
  2. En `lib/server-auth.ts:38-43`, la implementación manual de JWT no valida el encabezado `alg` del token y compara firmas mediante desigualdad estándar de cadenas (`signature !== expectedSignature`) en lugar de una comparación en tiempo constante (`crypto.timingSafeEqual`).
  3. En `middleware.ts:3-20`, la función `decodeJWT(token)` divide el token por `.` y decodifica únicamente `parts[1]` con `atob()`, **sin comprobar en absoluto la firma criptográfica**. Cualquier token con payload codificado en Base64URL que contenga `{"role":"ADMIN"}` supera el control de `middleware.ts`.
- **Impacto:** Falsificación trivial de sesiones para cualquier usuario existente o rol `ADMIN`, comprometiendo la totalidad de la autenticación de la aplicación.
- **Remediación:**
  - Exigir la presencia de `JWT_SECRET` en el arranque (lanzando un error fatal si no está definido o tiene menos de 256 bits de entropía) sin valores de respaldo (*fallback*) hardcodeados.
  - Sustituir la implementación manual de JWT por una librería auditada compatible con Node y Edge Runtime (como `jose`) fijando explícitamente `algorithms: ["HS256"]`, tanto en `lib/server-auth.ts` como en `middleware.ts`.

---

### Hallazgos de Severidad Alta

#### SEC-09 — Contraseñas en MD5 sin Sal, Registro de Contraseñas en Texto Plano y Consola SIEM con Credenciales por Defecto
- **Severidad:** Alta
- **Clasificación:** CWE-328 (Use of Weak Hash), CWE-532 (Insertion of Sensitive Information into Log File), CWE-798 (Hard-coded Credentials) | OWASP A02:2021, A09:2021
- **Ubicación:** `lib/server-auth.ts:14-16`, `app/api/auth/login/route.ts:16-25`, `app/api/monitoring/auth/route.ts:5-22`, `app/api/monitoring/logs/route.ts:7-26`, `app/news/page.tsx:4-17`, `app/api/user/export/route.ts:7`
- **Descripción técnica:**
  - Todas las contraseñas de usuarios se almacenan usando `MD5` sin sal (`crypto.createHash("md5")`).
  - En cada intento de autenticación (`POST /api/auth/login`, líneas 16-25), el servidor escribe en `logs/app.log` el correo y **la contraseña en texto plano** tanto en el objeto JSON estructurado como en el mensaje de log.
  - La consola SIEM (`/monitoring/siem`) y su API (`/api/monitoring/auth`, `/api/monitoring/logs`) utilizan credenciales fijas hardcodeadas (`SIEM_USER = "root"`, `SIEM_PASS = "admin"`) y establecen una cookie estática no firmada (`siem_session=authenticated`) sin atributos `secure` ni `sameSite`, permitiendo a cualquier atacante leer `logs/app.log` y cosechar todas las contraseñas en claro ingresadas por los usuarios.
  - Adicionalmente, `app/news/page.tsx:4-17` publica hashes MD5 reales en el código fuente, `app/login/LoginForm.tsx:60-64` muestra credenciales activas y `POST /api/user/export` (`route.ts:7`) incluye `"password"` entre los campos exportables (`ALLOWED_USER_FIELDS`).
- **Impacto:** Compromiso masivo de credenciales de usuarios y administradores tanto por reversión instantánea de MD5 como por lectura directa de contraseñas en claro desde el SIEM.
- **Remediación:**
  - Migrar el hashing de contraseñas a `Argon2id` (`argon2`) o `scrypt` / `bcrypt` con sal aleatoria por usuario.
  - Eliminar de inmediato el campo `password` de todos los eventos de log en `/api/auth/login` y configurar redacción automática en Pino (`redact: ["password", "headers.authorization", "headers.cookie"]`).
  - Eliminar `"password"` de `ALLOWED_USER_FIELDS` en `/api/user/export`, retirar credenciales/hashes expuestos en el frontend y proteger el SIEM mediante cuentas administrativas reales con secretos robustos y sesiones firmadas.

---

#### SEC-10 — Generación Predecible de Tokens de Restablecimiento de Contraseña con Fuga de Marca Temporal
- **Severidad:** Alta
- **Clasificación:** CWE-330 (Use of Insufficiently Random Values), CWE-640 (Weak Password Recovery Mechanism) | OWASP A02:2021, A07:2021
- **Ubicación:** `app/api/auth/forgot-password/route.ts:13-43`
- **Descripción técnica:**
  En `POST /api/auth/forgot-password`, el token de recuperación se genera de manera completamente determinista concatenando el correo electrónico con la marca de tiempo en segundos y aplicando MD5:
  ```ts
  const now = new Date();
  const requestedAt = now.toISOString();
  const timestamp = Math.floor(now.getTime() / 1000);
  // ...
  const token = hashMD5(email + timestamp);
  ```
  Además, la respuesta JSON devuelve explícitamente `requestedAt` al solicitante, revelando el segundo exacto (`timestamp`) con el que se calculó el token.
- **Impacto:** Toma de control de cualquier cuenta (incluidos administradores) sin acceso a su bandeja de correo, recalculando localmente el token y enviándolo a `POST /api/auth/reset-password`.
- **Remediación:**
  - Generar el token con al menos 32 bytes de entropía criptográfica (`crypto.randomBytes(32).toString("hex")`).
  - Almacenar únicamente el hash SHA-256 del token en la tabla `password_reset_tokens` (nunca el token en claro) y eliminar `requestedAt` de la respuesta HTTP.

---

#### SEC-11 — Manipulación del Precio Total en Compras y Condición de Carrera (*TOCTOU*) en Cupones
- **Severidad:** Alta
- **Clasificación:** CWE-472 (External Control of Assumed-Immutable Web Parameter), CWE-362 (Concurrent Execution using Shared Resource with Improper Synchronization) | OWASP A04:2021 (Insecure Design)
- **Ubicación:** `app/api/orders/route.ts:39,64-88,112-137`, `lib/validation/schemas/orders.ts:3-6`
- **Descripción técnica:**
  1. **Confianza en el total enviado por el cliente:** `POST /api/orders` recibe `total` directamente del cuerpo de la solicitud (`createOrderBodySchema` solo exige `z.number().positive()`) y crea el pedido con `total: total` sin recalcular la suma `precio * cantidad` de `cart.cartItems`. Un comprador puede adquirir cualquier cantidad de productos fijando un importe arbitrariamente bajo (p. ej., `0.01`) e incluso enviando un `couponCode` inexistente o no aplicado en el cálculo.
  2. **Condición de carrera (*Race Condition / TOCTOU*) en cupones:** El bloque de validación de cupones lee `coupon.usedCount < coupon.maxUses` (`líneas 65-73`), introduce una pausa asíncrona (`setTimeout(..., 150)`) y posteriormente incrementa `usedCount` sin una condición atómica ni transacción aislada, permitiendo reutilizar cupones limitados mediante peticiones paralelas.
  3. **Generación no atómica y secuencial de IDs de pedido:** El bucle `while` (líneas 113-137) carga todos los pedidos en memoria para calcular `ORD-001`, `ORD-002`..., degradando el rendimiento y generando identificadores trivialmente enumerables.
- **Impacto:** Pérdida económica directa por fraude en precios, abuso ilimitado de cupones promocionales y facilitación de enumeración de pedidos.
- **Remediación:**
  - Eliminar el campo `total` del payload de entrada de `POST /api/orders`; calcular el subtotal exclusivamente en el servidor a partir de los precios vigentes en base de datos.
  - Ejecutar la validación/consumo del cupón, creación del pedido, creación de líneas y vaciado del carrito dentro de una única transacción `prisma.$transaction`, actualizando el cupón de forma condicional atómica (`updateMany` con `where: { code, usedCount: { lt: coupon.maxUses } }` y verificando `count === 1`).
  - Usar identificadores no predecibles (`cuid()` o `crypto.randomUUID()`) para los pedidos.

---

#### SEC-12 — Control de Acceso Roto (IDOR / BOLA y BFLA) en Pedidos, Listas de Deseos y Retransmisión en Vivo
- **Severidad:** Alta
- **Clasificación:** CWE-639 (IDOR), CWE-285 (Improper Authorization) | OWASP A01:2021 (Broken Access Control)
- **Ubicación:**
  1. `app/api/orders/[id]/route.ts:8-64`
  2. `app/api/wishlists/[id]/route.ts:6-82`
  3. `app/api/live/stream/route.ts:30-100`
- **Descripción técnica:**
  - **Pedidos (`GET /api/orders/[id]`):** Protegido únicamente con `withAuth`. Consulta `prisma.order.findUnique({ where: { id } })` sin verificar que `order.userId === user.id` o `user.role === "ADMIN"`. Expone nombre, correo electrónico, importe y dirección postal completa de entrega de cualquier cliente.
  - **Listas de deseos (`GET /api/wishlists/[id]`):** Protegido con `withAuth`, devuelve cualquier lista de deseos e incluye `ownerEmail` aunque `wishlist.isPublic` sea `false` y el solicitante no sea su propietario (`wishlist.userId !== user.id`).
  - **Retransmisión en vivo (`GET` y `POST /api/live/stream`):** Ambos métodos usan `withAuth` en vez de `withAdminAuth`. `GET` expone a cualquier cliente autenticado las credenciales de ingesta (`rtmpUrl` y `streamKey`), mientras que `POST` permite explícitamente que usuarios con rol `CUSTOMER` modifiquen `liveVideoId` en la base de datos y alteren el vídeo mostrado públicamente en `/live` (marcando únicamente `hijacked = true` en lugar de rechazar la operación con `403 Forbidden`).
- **Impacto:** Exposición masiva de datos personales (PII) de clientes, divulgación de claves de transmisión RTMP y modificación no autorizada del contenido de emisión pública.
- **Remediación:**
  - En `GET /api/orders/[id]`, comprobar `if (order.userId !== user.id && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });`.
  - En `GET /api/wishlists/[id]`, rechazar con `403`/`404` cuando `!wishlist.isPublic && wishlist.userId !== user.id`, y omitir `ownerEmail` para terceros.
  - Cambiar `GET` y `POST` en `app/api/live/stream/route.ts` para usar `withAdminAuth` y nunca retornar `streamKey` en respuestas generales si no es estrictamente necesario.

---

#### SEC-13 — Cross-Site Scripting (XSS) Almacenado, Reflejado/SSRF, Basado en DOM y vía SVG
- **Severidad:** Alta
- **Clasificación:** CWE-79 (Cross-site Scripting), CWE-601 (URL Redirection to Untrusted Site) | OWASP A03:2021 (Injection)
- **Ubicación:**
  1. `app/products/[id]/ProductDetailClient.tsx:51-67` y `app/api/products/[id]/reviews/route.ts:41-74`
  2. `app/admin/analytics/AnalyticsClient.tsx:364-367`
  3. `app/support/SupportForm.tsx:103-105`
  4. `app/login/LoginForm.tsx:36-37`
  5. `app/api/admin/products/[id]/image/route.ts:9-15`, `app/api/uploads/[...path]/route.ts:12,44-49`, `app/products/[id]/ProductDetailClient.tsx:172-176`
- **Descripción técnica:**
  Se detectaron cinco vectores diferenciados de ejecución de JavaScript en el navegador:
  1. **XSS almacenado en reseñas de productos:** `POST /api/products/[id]/reviews` permite publicar reseñas sin autenticación. Al visualizar el producto, `ProductDetailClient.tsx` asigna `reviewElement.innerHTML = review.content` y clona manualmente todos los nodos `<script>` para forzar su ejecución en el navegador de cada visitante.
  2. **Blind XSS almacenado contra administradores en Analíticas:** `AnalyticsClient.tsx:366` renderiza `visit.ip` mediante `dangerouslySetInnerHTML={{ __html: visit.ip }}`. Como `/api/tracking` toma `ip` directamente de la cabecera `X-Forwarded-For` sin validar formato IP, cualquier visitante puede almacenar código HTML/JS que se ejecutará en la sesión del administrador al abrir `/admin/analytics`.
  3. **XSS en formulario de soporte:** `SupportForm.tsx:103-105` inyecta con `dangerouslySetInnerHTML` el contenido remoto recuperado por `/api/support` (`screenshotContent`).
  4. **DOM XSS y Open Redirect en Login:** `LoginForm.tsx:36-37` ejecuta `window.location.href = redirect;` tomando el parámetro `?redirect=` de la URL sin validar que sea una ruta interna relativa (`/...`), permitiendo tanto redirección abierta a sitios de phishing externos como ejecución de esquemas `javascript:`.
  5. **XSS almacenado vía subida de imágenes SVG:** Se permite subir archivos `image/svg+xml` que luego se sirven desde el mismo origen (`/api/uploads/...`) con `Content-Type: image/svg+xml` sin cabeceras de aislamiento y se embeben con `<object type="image/svg+xml">`, ejecutando scripts embebidos en el SVG bajo el origen de la aplicación.
- **Impacto:** Ejecución arbitraria de JavaScript en el contexto de clientes y administradores, robo o abuso de sesiones autenticadas, realización de acciones administrativas forzadas y redirección a sitios maliciosos.
- **Remediación:**
  - Renderizar `review.content`, `visit.ip` y resúmenes de soporte como texto plano de React (`{review.content}`, `{visit.ip}`), eliminando `innerHTML`, la clonación de `<script>` y `dangerouslySetInnerHTML`. Validar además en `/api/tracking` el formato de dirección IP y tomar la IP confiable del socket/proxy reverso configurado.
  - En `LoginForm.tsx`, validar que `redirect` comience por un único `/` y no por `//` ni contenga esquemas (`/^\/(?!\/)/`), usando `router.push(safeRedirect)`.
  - Prohibir la subida de archivos `image/svg+xml` (restringiendo a formatos rasterizados JPEG/PNG/WebP re-codificados con una librería como `sharp`) o servir subidas desde un dominio aislado (*sandbox domain*) con `Content-Security-Policy: sandbox` y `Content-Disposition: attachment`.

---

#### SEC-14 — Oráculo de Relleno (*Padding Oracle*) y Maleabilidad AES-CBC en Enlaces Compartidos + PRNG Débil en Tarjetas de Regalo
- **Severidad:** Alta
- **Clasificación:** CWE-327 (Broken or Risky Crypto Algorithm), CWE-209 (Error Message Information Leak), CWE-338 (Cryptographically Weak PRNG) | OWASP A02:2021 (Cryptographic Failures)
- **Ubicación:** `lib/share-crypto.ts:3-32`, `app/api/documents/share/route.ts:13-42`, `lib/gift-card.ts:5-25`, `app/api/gift-cards/route.ts:51-52`
- **Descripción técnica:**
  1. **AES-256-CBC sin autenticación y Padding Oracle (`lib/share-crypto.ts` y `/api/documents/share`):**
     - `SHARE_KEY` tiene una clave hexadecimal por defecto hardcodeada en el código fuente (`lib/share-crypto.ts:6-10`).
     - El cifrado utiliza `aes-256-cbc` sin etiqueta de autenticación (sin HMAC ni AEAD).
     - `GET /api/documents/share` actúa como un **Padding Oracle** directo: si `decipher.final()` falla por relleno PKCS#7 inválido, devuelve `400 {"error": "Invalid share token format"}`, mientras que si el relleno es válido pero el texto descifrado carece de `:` o referencia un tipo/recurso distinto, devuelve `404` o `400 {"error": "Unsupported resource type '...'"}` (filtrando incluso el `resourceType` descifrado en el mensaje de error). Esto permite tanto descifrar tokens como forjar textos cifrados arbitrarios mediante ataques de *CBC bit-flipping* o *Padding Oracle encryption* (p. ej., acceder a `report:internal` o a pedidos de otros usuarios sin conocer la clave).
  2. **PRNG lineal predecible en Tarjetas de Regalo (`lib/gift-card.ts`):**
     - `generateGiftCardCode(seed)` implementa un Generador Congruencial Lineal (LCG) de 31 bits (`Math.imul(state, 1103515245) + 12345`) cuya semilla en `POST /api/gift-cards` (`route.ts:51-52`) es `createdAt.getTime()`. Conociendo la ventana temporal aproximada en que se emitió una tarjeta (o observando un único código propio y su `createdAt`), es trivial predecir los códigos pendientes de canje en `/api/gift-cards/redeem` e incrementar fraudulentamente `creditBalance`.
- **Impacto:** Acceso no autorizado a documentos internos y pedidos compartidos de terceros, así como generación/robo de saldo mediante predicción de tarjetas de regalo.
- **Remediación:**
  - Sustituir `aes-256-cbc` en `lib/share-crypto.ts` por cifrado autenticado **`aes-256-gcm`** (incluyendo IV aleatorio de 12 bytes y `authTag` de 16 bytes), exigir `SHARE_ENCRYPTION_KEY` desde variables de entorno sin valor por defecto y unificar todas las respuestas de error de `/api/documents/share` en un único mensaje genérico sin filtrar `resourceType`.
  - Sustituir el LCG de `lib/gift-card.ts` por `crypto.randomInt(0, ALPHABET.length)` en cada carácter del código.

---

#### SEC-15 — Inyección de Prompts, SSRF / Envenenamiento de Herramientas MCP y Autenticación MCP Estática
- **Severidad:** Alta
- **Clasificación:** CWE-77 (Command/Prompt Injection), CWE-918 (SSRF), CWE-287 (Improper Authentication) | OWASP Top 10 for LLM: LLM01 (Prompt Injection), LLM02 (Sensitive Information Disclosure), LLM07 (System Prompt Leakage)
- **Ubicación:** `app/api/ai-assistant/route.ts:8-34,167-212`, `lib/prompt-injection-filter.ts:1-9`, `app/api/mcp/route.ts:142-183`, `lib/mcp-constants.ts:1-2`
- **Descripción técnica:**
  1. **Datos sensibles en el System Prompt y filtro de Prompt Injection trivial:** `SYSTEM_PROMPT` (`route.ts:17-24`) contiene valores internos confidenciales y delega al propio LLM la restricción de no invocar la herramienta `get_compliance_report` salvo que exista una "directiva oficial". El filtro previo (`lib/prompt-injection-filter.ts`) solo comprueba 4 expresiones regulares en inglés fácilmente eludibles con sinónimos, otros idiomas o reformulaciones.
  2. **SSRF y Envenenamiento de Herramientas (*MCP Tool Poisoning*) vía `mcpServerUrl`:** `POST /api/ai-assistant` (accesible sin autenticación de aplicación) acepta un parámetro `mcpServerUrl` arbitrario y realiza peticiones `POST` JSON-RPC desde el servidor (`discoverTools` y `callMcpTool`), habilitando SSRF. Además, fusiona las definiciones de herramientas devueltas por ese servidor externo no confiable junto con las herramientas internas autenticadas en la misma llamada al modelo, permitiendo que descripciones o respuestas maliciosas del servidor MCP externo inyecten instrucciones indirectas para que el modelo invoque `get_compliance_report` y exfiltre su resultado.
  3. **Autenticación MCP por cabecera estática pública:** `POST /api/mcp` está expuesto públicamente y concede privilegios de agente interno simplemente enviando la cabecera constante `X-MCP-Session: quokka-internal-agent` definida en `lib/mcp-constants.ts`.
- **Impacto:** Extracción de secretos del prompt del sistema, acceso directo o indirecto a reportes internos de cumplimiento (`get_compliance_report`) y SSRF contra servicios internos.
- **Remediación:**
  - Nunca incluir secretos, claves ni códigos de validación en un `SYSTEM_PROMPT`, ni confiar en instrucciones textuales al LLM como mecanismo de control de acceso; eliminar herramientas privilegiadas del catálogo expuesto a chats de atención al cliente público.
  - Eliminar la capacidad del cliente de suministrar `mcpServerUrl` arbitrarios en producción (o restringirlo estrictamente a integraciones preaprobadas en el servidor).
  - Proteger `/api/mcp` mediante un secreto criptográfico de entorno de alta entropía validado en tiempo constante y restringir su exposición únicamente a llamadas internas autorizadas.

---

### Hallazgos de Severidad Media

#### SEC-16 — Ausencia de Protección CSRF en Endpoints Mutables (`x-www-form-urlencoded` y Login vía `GET`)
- **Severidad:** Media
- **Clasificación:** CWE-352 (Cross-Site Request Forgery) | OWASP A01:2021
- **Ubicación:** `lib/server-auth.ts:71-79`, `app/api/user/profile/route.ts:60-66`, `app/api/orders/[id]/route.ts:87-91,182-185`, `app/api/auth/support-login/route.ts:8`
- **Descripción técnica:**
  La cookie de sesión `authToken` se configura con `sameSite: "lax"` y no existe validación de token anti-CSRF ni comprobación de cabeceras `Origin`/`Referer`. Aunque `SameSite=Lax` mitiga peticiones `POST` cross-site en navegadores modernos, existen dos debilidades importantes:
  1. `POST /api/user/profile` y `POST /api/orders/[id]` aceptan explícitamente `application/x-www-form-urlencoded` (formularios HTML estándar sin preflight CORS), lo que permite ataques CSRF desde subdominios hermanos o navegadores/configuraciones que no apliquen `Lax` por defecto, o durante la ventana inicial de emisión de cookies en ciertos motores.
  2. `GET /api/auth/support-login` muta el estado de autenticación en una navegación `GET` de nivel superior (*top-level navigation*), donde `SameSite=Lax` sí adjunta y procesa cookies, permitiendo **Login CSRF** (forzar al navegador de la víctima a autenticarse silenciosamente en una cuenta controlada por el atacante).
- **Remediación:**
  - Validar en un middleware o wrapper común que el encabezado `Origin` (o `Referer`) coincida exactamente con el origen esperado de la aplicación en todos los métodos mutables (`POST`, `PUT`, `PATCH`, `DELETE`), exigir `Content-Type: application/json` eliminando el soporte innecesario de `application/x-www-form-urlencoded` en APIs JSON, e implementar tokens CSRF sincronizados o *Double Submit Cookie*.
  - Convertir `/api/auth/support-login` a `POST`.

---

#### SEC-17 — Exposición de Secretos en Cliente (`NEXT_PUBLIC_`), Endpoint de Diagnóstico Hardcodeado, Filtración de Datos Internos y Riesgo de Cadena de Suministro
- **Severidad:** Media
- **Clasificación:** CWE-200 (Exposure of Sensitive Information), CWE-209 (Information Exposure Through an Error Message), CWE-489 (Active Debug Code) | OWASP A05:2021, A08:2021
- **Ubicación:** `.env.local:1`, `app/checkout/CheckoutClient.tsx:119,140`, `app/api/admin/diag/route.ts:5-25`, `app/admin/documents/page.tsx:5-6,12`, `app/api/user/export/route.ts:35-92`, `app/api/flags/route.ts:5-14`, `app/api/flags/[slug]/route.ts:5-20`, `public/notice.txt`
- **Descripción técnica:**
  - **Variable `NEXT_PUBLIC_PAYMENT_SECRET`:** En Next.js, toda variable con prefijo `NEXT_PUBLIC_` se incrusta en tiempo de compilación dentro de los bundles JavaScript públicos servidos al navegador (`CheckoutClient.tsx:119`). Además, `POST /api/orders` ni siquiera valida la cabecera `X-Payment-Auth`.
  - **Endpoint de diagnóstico con credencial hardcodeada y nota oculta en HTML:** `GET /api/admin/diag` autentica solicitudes comparando `x-debug-auth` contra el literal hardcodeado `"dbg_8f3a7c91e2b4d6a05e21"`. Asimismo, `app/admin/documents/page.tsx:5-6` inyecta un comentario HTML oculto en el DOM que alude a la descarga de un paquete con nombre mal escrito (`react-toastfy` en lugar de `react-toastify`) desde un registro interno, reflejando un patrón clásico de vulnerabilidad a *Typosquatting* / *Dependency Confusion*.
  - **Fuga de diagnósticos en errores de exportación:** En `POST /api/user/export` (`route.ts:77-92,130-141`), el envío de cualquier nombre de campo no permitido provoca que el servidor ejecute `getSystemDiagnostics()` y devuelva versiones internas del entorno, trazas de error de base de datos (`stack`) y registros sensibles de la tabla `flags`.
  - **Endpoints `/api/flags` y `/api/flags/[slug]` y archivos estáticos:** Rutas accesibles sin autenticación que vuelcan registros completos de la tabla `flags`, además de archivos sensibles publicados directamente bajo `public/` (`public/notice.txt`).
- **Remediación:**
  - Eliminar secretos del cliente; gestionar integraciones de pasarelas de pago exclusivamente en el servidor con variables privadas sin el prefijo `NEXT_PUBLIC_`.
  - Eliminar `/api/admin/diag`, los comentarios HTML de desarrollo y los volcados de `systemDiagnostics` / `stack` en respuestas HTTP al cliente.
  - Restringir o retirar endpoints internos de administración/evaluación y fijar configuración estricta de registros npm (`package-lock.json` verificado con `npm ci --ignore-scripts` cuando proceda y scopes privados explícitos).

---

#### SEC-18 — Inyección de Cabecera `Host` / `X-Forwarded-Proto` en Enlaces Compartidos
- **Severidad:** Media
- **Clasificación:** CWE-644 (Improper Neutralization of HTTP Headers for Scripting Syntax) | OWASP A05:2021
- **Ubicación:** `app/api/orders/[id]/share/route.ts:21-23`
- **Descripción técnica:**
  Al generar un enlace de compartición de pedido, el servidor construye la URL absoluta confiando directamente en las cabeceras HTTP enviadas por el cliente:
  ```ts
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host") || "localhost:3000";
  const shareUrl = `${protocol}://${host}/api/documents/share?token=${token}`;
  ```
- **Impacto:** Permite generar enlaces apuntando a dominios controlados por un atacante si la solicitud es manipulada o si existe envenenamiento de caché intermedia, facilitando el robo de tokens de compartición.
- **Remediación:** Construir URLs públicas absolutas utilizando exclusivamente una variable de configuración canónica confiable del servidor (p. ej., `APP_BASE_URL`), nunca cabeceras HTTP no validadas.

---

#### SEC-19 — Ausencia Global de Limitación de Tasa (*Rate Limiting*) y Enumeración de Usuarios
- **Severidad:** Media
- **Clasificación:** CWE-307 (Improper Restriction of Excessive Authentication Attempts), CWE-204 (Observable Response Discrepancy) | OWASP A07:2021
- **Ubicación:** `app/api/auth/login/route.ts:39-48`, `app/api/auth/signup/route.ts:22-27`, `app/api/monitoring/auth/route.ts:14-24`, `app/api/gift-cards/redeem/route.ts:24`, `app/api/coupon/[code]/route.ts:6`
- **Descripción técnica:**
  - Ningún endpoint de la aplicación implementa *rate limiting*, bloqueo progresivo ni CAPTCHA, permitiendo ataques de fuerza bruta y *credential stuffing* contra `/api/auth/login` y `/api/monitoring/auth`, así como enumeración masiva de códigos en `/api/gift-cards/redeem` y `/api/coupon/[code]`.
  - Adicionalmente, `POST /api/auth/login` distingue explícitamente entre usuario inexistente (`"Invalid credentials"`, línea 41) y contraseña incorrecta (`"Invalid password"`, línea 47), permitiendo enumerar correos registrados con certeza absoluta.
- **Remediación:**
  - Implementar limitación de tasa por IP y por cuenta/identificador en todos los endpoints de autenticación, recuperación, canje de códigos y asistente de IA.
  - Unificar el mensaje de error y el tiempo de respuesta en `/api/auth/login` (ejecutando un hash ficticio cuando el usuario no exista y retornando siempre `"Invalid email or password"`).

---

### Hallazgos de Severidad Baja

#### SEC-20 — Contenedor Docker Ejecutado como `root`, Compiladores en Producción e Inclusión de `.env.local`
- **Severidad:** Baja (Amplificador de impacto post-explotación)
- **Clasificación:** CWE-250 (Execution with Unnecessary Privileges), CWE-538 (Insertion of Sensitive Information into Externally-Accessible File or Directory) | OWASP A05:2021
- **Ubicación:** `Dockerfile:1-34`, `.dockerignore:1-24`, `.gitignore:37`
- **Descripción técnica:**
  1. Tanto `.gitignore` como `.dockerignore` excluyen únicamente `.env`, pero **no excluyen `.env.local` ni `.env.*`**. Como resultado, `.env.local` (con secretos) permanece en el árbol del proyecto y se copia dentro de la imagen de contenedor durante `COPY . .` (`Dockerfile:10`).
  2. `Dockerfile` utiliza una única etapa (*single-stage build*) que deja instalados `python3`, `make`, `g++` y `gcc` en la imagen de producción y nunca cambia a un usuario sin privilegios (`USER node`), ejecutando el proceso de aplicación como `root`.
- **Remediación:**
  - Añadir `.env.*` (excepto `.env.example`) a `.gitignore` y `.dockerignore`, y rotar cualquier secreto previamente expuesto.
  - Reestructurar el `Dockerfile` con *multi-stage builds* (`builder` y `runner` con `output: "standalone"` en Next.js), eliminando herramientas de compilación de la imagen final y ejecutando el contenedor bajo `USER node`.

---

#### SEC-21 — Ausencia de Cabeceras de Seguridad HTTP
- **Severidad:** Baja
- **Clasificación:** CWE-693 (Protection Mechanism Failure) | OWASP A05:2021
- **Ubicación:** `next.config.ts:1-19`
- **Descripción técnica:**
  `next.config.ts` no configura cabeceras defensivas en `headers()`, dejando las respuestas sin `Content-Security-Policy` (CSP), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` / `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` ni `Strict-Transport-Security` (HSTS). La falta de CSP y `X-Frame-Options` agrava notablemente el impacto de los hallazgos de XSS (**SEC-13**) y permite ataques de *Clickjacking*.
- **Remediación:** Definir una política estricta de cabeceras HTTP globales en `next.config.ts` mediante la función asíncrona `headers()`.

---

#### SEC-22 — Exposición de Prisma Studio sin Autenticación en `scripts/setup.sh`
- **Severidad:** Baja
- **Clasificación:** CWE-306 (Missing Authentication for Critical Function) | OWASP A05:2021
- **Ubicación:** `scripts/setup.sh:53-54,77`
- **Descripción técnica:**
  El script de configuración e inicio lanza automáticamente `npx prisma studio -b none &` en el puerto `5555` junto con `npm start`. Prisma Studio ofrece lectura y escritura directa sobre todas las tablas de la base de datos sin capa de autenticación propia. Si se ejecuta en un servidor compartido o máquina con el puerto `5555` accesible en red, expone toda la base de datos.
- **Remediación:** No iniciar herramientas de administración de desarrollo (`prisma studio`) automáticamente junto al servidor de producción (`npm start`); limitarlo a un comando explícito de desarrollo local ligado exclusivamente a `127.0.0.1`.

---

## 4. Plan de Remediación Priorizado

1. **Fase 1 — Contención Inmediata (Prioridad Crítica, 24–72 h):**
   - Actualizar `next`, `react` y `react-dom` a versiones parcheadas (**SEC-01**).
   - Exigir secretos fuertes desde variables de entorno (`JWT_SECRET`, `SHARE_ENCRYPTION_KEY`), eliminar fallbacks hardcodeados y validar criptográficamente la firma JWT tanto en API como en `middleware.ts` (**SEC-08**).
   - Eliminar `role` del esquema de registro (**SEC-03**), restringir `/api/user/support-access` al propio usuario verificando `revoked: false` (**SEC-04**) y proteger `/api/files` con `withAdminAuth` + validación canónica de rutas (**SEC-05**).
   - Reemplazar todas las consultas `prisma.$queryRawUnsafe` y `db.exec` por consultas tipadas de Prisma (**SEC-02**), desactivar `noent`/`dtdload` en XML (**SEC-06**) y eliminar el `fetch` arbitrario en `/api/support` así como la autorización por cabecera `x-internal-request` (**SEC-07**).

2. **Fase 2 — Endurecimiento de Lógica de Negocio, Criptografía y Frontend (Corto Plazo, 1–2 semanas):**
   - Migrar contraseñas a `Argon2id`, suprimir el logueo de contraseñas, retirar credenciales hardcodeadas del SIEM y reemplazar el generador de tokens de recuperación por `crypto.randomBytes(32)` (**SEC-09**, **SEC-10**).
   - Calcular totales y cupones de forma transaccional en el servidor (**SEC-11**) y aplicar controles de propiedad/rol en `/api/orders/[id]`, `/api/wishlists/[id]` y `/api/live/stream` (**SEC-12**).
   - Eliminar usos inseguros de `innerHTML`/`dangerouslySetInnerHTML`, bloquear carga de SVGs ejecutables y restringir redirecciones post-login a rutas internas (**SEC-13**).
   - Migrar `share-crypto.ts` a `aes-256-gcm`, usar `crypto.randomInt` para tarjetas de regalo (**SEC-14**) y aislar el asistente de IA eliminando secretos del prompt y URLs MCP arbitrarias (**SEC-15**).

3. **Fase 3 — Defensa en Profundidad e Infraestructura (Medio Plazo, 2–4 semanas):**
   - Incorporar protección CSRF y validación de `Origin` (**SEC-16**), eliminar variables `NEXT_PUBLIC_` sensibles y endpoints de depuración (**SEC-17**, **SEC-18**) e implantar *Rate Limiting* (**SEC-19**).
   - Adoptar *multi-stage builds* en Docker ejecutando como usuario no privilegiado, excluir `.env.*` en `.gitignore`/`.dockerignore`, añadir cabeceras HTTP de seguridad (CSP, HSTS, `nosniff`, `frame-ancestors`) y desacoplar Prisma Studio del arranque (**SEC-20**, **SEC-21**, **SEC-22**).
