# Auditoría de Seguridad — Quokka Bazaar

**Fecha:** 24 de noviembre de 2026  
**Proyecto:** `quokka-bazaar` (v2.17.0 — Next.js 15 / Prisma / SQLite)  
**Tipo de evaluación:** Revisión estática de código fuente, configuración y dependencias (caja blanca)

---

## 1. Resumen Ejecutivo

Se realizó una auditoría integral de seguridad sobre el código fuente, los esquemas de validación, la configuración de infraestructura y las dependencias del proyecto **Quokka Bazaar**.

La aplicación presenta **riesgos de seguridad críticos y generalizados** en prácticamente todas las capas (autenticación, autorización, validación de entradas, lógica de negocio, criptografía, manejo de archivos y configuración de despliegue). En su estado actual, el sistema **no es apto para entornos productivos o expuestos a red** y requiere remediación estructural antes de su despliegue.

### Resumen de Hallazgos por Severidad

| Severidad | Cantidad | Áreas Principales Afectadas |
| :--- | :---: | :--- |
| **Crítica** | 8 | Inyección SQL (x4), Escalada de privilegios en registro, Suplantación/revocación rota en tokens de soporte, XXE en importación XML, Path Traversal sin autenticación, Secreto JWT débil por defecto, Reset de contraseña predecible, Manipulación de precios en pedidos |
| **Alta** | 11 | IDOR (órdenes y wishlists), Control de acceso roto en streaming, Bypass por cabecera / paneles expuestos, MD5 sin sal y enumeración, XSS almacenado/reflejado/SVG (x4), Open Redirect, SSRF (x2), Race condition en cupones, Credenciales hardcodeadas y logs con contraseñas en texto plano, AES-CBC sin autenticación, Dependencias con CVEs conocidos |
| **Media** | 7 | Generación predecible de gift cards y abuso de saldo, Exposición de datos/diagnósticos en export, Exposición de `.env.local` y secretos `NEXT_PUBLIC_`, Debilidades en integración IA/MCP, Validación de subida de archivos por MIME de cliente, Contenedor Docker como `root` y `prisma studio` en setup, Ausencia de cabeceras de seguridad HTTP y protección CSRF |

---

## 2. Alcance y Metodología

La auditoría cubrió:
- **Rutas de API (`app/api/**`):** Autenticación, usuarios, administración, carrito, órdenes, cupones, tarjetas de regalo, listas de deseos, archivos, monitoreo, soporte, asistente IA y servidor MCP.
- **Páginas y Componentes (`app/**`):** Manejo de sesiones en cliente, renderizado de contenido dinámico, redirecciones y exposición de datos.
- **Bibliotecas y Validación (`lib/**`, `hooks/**`):** Criptografía, tokens JWT, configuración, logging y esquemas Zod.
- **Base de Datos y Despliegue (`prisma/**`, `Dockerfile`, `docker-compose.yml`, `scripts/**`, `package.json`, `.env.local`):** Esquema de datos, scripts de inicialización, contenedores y dependencias.

---

## 3. Hallazgos Críticos

### [CRIT-01] Múltiples vulnerabilidades de Inyección SQL (SQLi)
- **Clasificación:** CWE-89 | OWASP A03:2021 (Injection)
- **Ubicaciones:**
  - `app/api/products/search/route.ts` (líneas 85–103) — sin autenticación
  - `app/api/orders/search/route.ts` (líneas 81–105) — requiere sesión de usuario
  - `app/api/admin/reviews/route.ts` (líneas 103–136) — requiere rol `ADMIN` (alcanzable vía escalada de privilegios)
  - `app/api/tracking/route.ts` (líneas 58–103) — sin autenticación
- **Descripción:**  
  Se construyen consultas SQL concatenando directamente entradas controladas por el usuario o cabeceras HTTP mediante `prisma.$queryRawUnsafe(...)` o `better-sqlite3` (`db.exec()` / `db.prepare()`):
  - En `/api/products/search`, el parámetro `q` se interpola dentro de `LIKE '%${query}%'`.
  - En `/api/orders/search`, el campo `status` del cuerpo JSON (validado solo como `z.string().optional()` en `lib/validation/schemas/orders.ts`) se interpola en `AND o.status = '${status}'`.
  - En `/api/admin/reviews`, `authorFilter` se concatena en la consulta y además se ejecuta con `db.exec(query)`, que en `better-sqlite3` permite múltiples sentencias separadas por `;` (stacked queries), posibilitando alteración o borrado de datos.
  - En `/api/tracking`, las cabeceras `x-forwarded-for` / `x-real-ip` (`ip`) y el parámetro `sessionId` se concatenan directamente en una sentencia `INSERT` sin ningún escape ni parametrización.
- **Impacto:** Lectura no autorizada de toda la base de datos SQLite (credenciales, tokens, pedidos, PII), modificación/destrucción de datos y denegación de servicio.
- **Remediación:**
  - Reemplazar todas las consultas concatenadas por consultas tipadas del ORM (`prisma.product.findMany`, `prisma.order.findMany`, `prisma.review.findMany`, `prisma.visitorLog.create`) o usar `prisma.$queryRaw` con tagged templates parametrizados.
  - Eliminar el uso de `db.exec()` sobre entradas dinámicas y restringir valores discretos como `status` mediante `z.enum([...])`.

---

### [CRIT-02] Escalada de privilegios a `ADMIN` en el registro de usuarios
- **Clasificación:** CWE-915 / CWE-269 | OWASP A01:2021 (Broken Access Control)
- **Ubicaciones:**
  - `app/api/auth/signup/route.ts` (líneas 58–61)
  - `lib/validation/schemas/auth.ts` (líneas 3–9)
- **Descripción:**  
  `signupBodySchema` define `role: z.string().optional()` con `.passthrough()`, y el endpoint `POST /api/auth/signup` asigna `userData.role = body.role as UserRole` si el cliente envía dicho campo en el JSON de registro.
- **Impacto:** Cualquier usuario anónimo puede crear una cuenta directamente con rol `ADMIN`, obteniendo acceso completo a los paneles y endpoints administrativos (incluyendo XXE, SQLi en reseñas, subida de archivos, órdenes de todos los clientes y logs).
- **Remediación:**
  - Eliminar `role` de `signupBodySchema` y quitar `.passthrough()`.
  - Fijar explícitamente `role: UserRole.CUSTOMER` en la creación de cuentas desde `/api/auth/signup`.

---

### [CRIT-03] Suplantación de identidad y bypass de revocación en tokens de soporte
- **Clasificación:** CWE-639 / CWE-613 / CWE-284 | OWASP A01:2021 & A07:2021
- **Ubicaciones:**
  - `app/api/user/support-access/route.ts` (líneas 51–91)
  - `app/api/auth/support-login/route.ts` (líneas 15–49)
  - `lib/validation/schemas/user.ts` (líneas 15–19)
  - `app/support-login/page.tsx` (línea 20)
- **Descripción:**
  1. `POST /api/user/support-access` acepta un campo opcional `email` en el cuerpo de la petición (`const targetEmail = parsed.data?.email || user.email`) y genera un `SupportAccessToken` válido para ese `targetUser` **sin comprobar autorización** (cualquier usuario autenticado puede generar un token de acceso para cualquier otra cuenta, incluida la de administrador).
  2. `GET /api/auth/support-login` consulta el token por su valor único pero **omite comprobar `supportToken.revoked`**. Aunque `DELETE /api/user/support-access` marca `revoked: true`, los tokens revocados siguen permitiendo iniciar sesión.
  3. Tanto los tokens de soporte como el JWT resultante tienen una vigencia de **365 días** (`TOKEN_EXPIRY_DAYS = 365`). Además, la ruta de login de soporte opera mediante `GET` con el token en la URL, quedando expuesto en historiales y registros.
- **Impacto:** Toma total de cuentas de cualquier usuario o administrador por parte de cualquier usuario autenticado, y persistencia de acceso tras la revocación.
- **Remediación:**
  - Ignorar cualquier `email` enviado por el cliente en `POST /api/user/support-access` y vincular la creación estrictamente a `user.id` / `user.email` de la sesión autenticada.
  - Verificar `!supportToken.revoked` en `/api/auth/support-login`.
  - Reducir drásticamente la vigencia de los tokens de soporte (p. ej., 15–60 minutos, de un solo uso), migrar el intercambio a `POST` en el cuerpo HTTP y almacenar un hash del token en base de datos en lugar del secreto en claro.

---

### [CRIT-04] Secreto JWT hardcodeado por defecto y validación débil de tokens
- **Clasificación:** CWE-798 / CWE-347 | OWASP A02:2021 & A07:2021
- **Ubicación:** `lib/server-auth.ts` (líneas 12, 31–57)
- **Descripción:**
  - La clave de firma JWT se define como `process.env.JWT_SECRET || "secret"`. Ni `.env.local` ni `docker-compose.yml` definen `JWT_SECRET`, por lo que en ejecución se utiliza `"secret"`.
  - `decodeSessionToken` no valida el campo `alg` de la cabecera del JWT, utiliza comparación simple de cadenas (`!==`) en lugar de `crypto.timingSafeEqual` y solo verifica la expiración si `payload.exp` existe (`if (payload.exp && ...)`), permitiendo tokens sin expiración.
- **Impacto:** Falsificación trivial de sesiones para cualquier usuario o rol (`ADMIN`) sin necesidad de credenciales.
- **Remediación:**
  - Exigir `JWT_SECRET` mediante variable de entorno obligatoria de alta entropía (fallar al arrancar si falta o es débil).
  - Usar una librería JWT estándar o validar estrictamente `header.alg === "HS256"`, obligatoriedad de `exp` y comparación de firma con `crypto.timingSafeEqual`.

---

### [CRIT-05] Inyección de Entidades Externas XML (XXE)
- **Clasificación:** CWE-611 | OWASP A05:2021 (Security Misconfiguration)
- **Ubicación:** `app/api/admin/suppliers/import-order/route.ts` (líneas 21–24)
- **Descripción:**  
  El analizador XML se invoca con `libxmljs.parseXmlString(rawXml, { noent: true, dtdload: true })`. La combinación de `noent: true` y `dtdload: true` habilita la resolución de DTD externas y la sustitución de entidades externas dentro de los nodos XML cuyo contenido se almacena y devuelve en la respuesta JSON.
- **Impacto:** Lectura arbitraria de archivos del servidor (archivos de configuración, base de datos, secretos), SSRF desde el servidor y denegación de servicio (ataques tipo Billion Laughs).
- **Remediación:**
  - Deshabilitar explícitamente la carga de DTD y la expansión de entidades (`noent: false`, `dtdload: false`, `dtdvalid: false`), o rechazar documentos que contengan declaraciones `<!DOCTYPE` / `<!ENTITY`.
  - Considerar reemplazar `libxmljs2` por un parser XML puro en JS sin soporte de entidades externas ni dependencias nativas inseguras.

---

### [CRIT-06] Path Traversal y exposición sin autenticación del sistema de archivos
- **Clasificación:** CWE-22 / CWE-306 | OWASP A01:2021 (Broken Access Control)
- **Ubicación:** `app/api/files/route.ts` (líneas 8–72)
- **Descripción:**
  - El endpoint `GET /api/files` carece de cualquier control de autenticación o autorización (no utiliza `withAuth` ni `withAdminAuth`), a pesar de ser consumido desde la sección administrativa (`/admin/documents`).
  - Construye rutas mediante `join(baseDir, dirPath)` (para listar directorios con `list=true`) y `join(baseDir, file)` (para leer contenidos) sin verificar que la ruta resuelta permanezca dentro de `documents/`.
- **Impacto:** Cualquier usuario no autenticado puede listar directorios y leer archivos arbitrarios accesibles para el proceso Node.js (`.env.local`, base de datos `prisma/dev.db`, `logs/app.log`, código fuente, archivos del sistema operativo).
- **Remediación:**
  - Proteger el endpoint con `withAdminAuth`.
  - Normalizar y validar las rutas usando `path.resolve(baseDir, input)` y comprobar que `resolvedPath.startsWith(resolvedBaseDir + path.sep)` (y resolver enlaces simbólicos con `fs.realpathSync`), además de aplicar una lista blanca de extensiones o identificadores de archivo.

---

### [CRIT-07] Tokens de restablecimiento de contraseña predecibles
- **Clasificación:** CWE-330 / CWE-640 | OWASP A02:2021 & A07:2021
- **Ubicación:** `app/api/auth/forgot-password/route.ts` (líneas 13–43)
- **Descripción:**  
  El token se calcula determinísticamente como `hashMD5(email + timestamp)` usando la marca de tiempo en segundos (`Math.floor(now.getTime() / 1000)`). Adicionalmente, la respuesta HTTP devuelve `requestedAt` con la fecha/hora exacta del servidor en formato ISO.
- **Impacto:** Cualquier atacante que solicite un restablecimiento para un correo conocido (incluido `admin@quokka.store`) puede derivar el token exacto localmente y restablecer la contraseña de esa cuenta mediante `POST /api/auth/reset-password`.
- **Remediación:**
  - Generar tokens con `crypto.randomBytes(32).toString("hex")` (alta entropía criptográfica).
  - Almacenar el hash SHA-256 del token en la base de datos en lugar del token en claro, y no devolver `requestedAt` ni marcas temporales internas.

---

### [CRIT-08] Manipulación de precios e integridad de pagos en el cliente
- **Clasificación:** CWE-840 / CWE-472 | OWASP A04:2021 (Insecure Design)
- **Ubicaciones:**
  - `app/api/orders/route.ts` (líneas 39, 130)
  - `app/api/coupon/apply/route.ts` (líneas 12, 36)
  - `app/checkout/CheckoutClient.tsx` (líneas 119–142)
- **Descripción:**
  - `POST /api/orders` recibe `total` directamente del cuerpo de la petición del cliente y lo persiste sin calcular el subtotal real desde los productos del carrito en base de datos ni recalcular el descuento del cupón en el servidor.
  - De igual forma, `POST /api/coupon/apply` calcula el descuento sobre un `cartTotal` proporcionado por el cliente.
  - No existe verificación real de pago en el servidor (la cabecera `X-Payment-Auth` enviada por el cliente con `NEXT_PUBLIC_PAYMENT_SECRET` ni siquiera se valida en `/api/orders`).
- **Impacto:** Compra de artículos de cualquier valor por un importe arbitrario (p. ej. `$0.01`).
- **Remediación:**
  - Eliminar `total` de `createOrderBodySchema`. Calcular el importe total exclusivamente en el servidor sumando `item.product.price * item.quantity` dentro de una transacción de base de datos, aplicando allí el descuento verificado del cupón.

---

## 4. Hallazgos Altos

### [ALTO-01] Referencia Directa a Objetos Insegura (IDOR) en Órdenes y Wishlists
- **Clasificación:** CWE-639 | OWASP A01:2021 (Broken Access Control)
- **Ubicaciones:**
  - `app/api/orders/[id]/route.ts` (líneas 8–75)
  - `app/api/orders/route.ts` (líneas 115–124)
  - `app/api/wishlists/[id]/route.ts` (líneas 6–92)
- **Descripción:**
  - `GET /api/orders/[id]` requiere autenticación (`withAuth`), pero no verifica si `order.userId === user.id` ni si el usuario tiene rol `ADMIN`. Combinado con identificadores secuenciales predecibles (`ORD-001`, `ORD-002`, ...), cualquier cliente puede enumerar y leer correos electrónicos, direcciones postales, importes y estados de pedidos ajenos.
  - `GET /api/wishlists/[id]` requiere `withAuth`, pero devuelve cualquier lista de deseos independientemente de si `wishlist.isPublic` es `false` y sin comprobar `wishlist.userId === user.id`, filtrando además `ownerEmail`.
- **Remediación:**
  - Validar la propiedad del recurso en el servidor (`if (order.userId !== user.id && user.role !== "ADMIN") return 403`; en wishlists, `if (!wishlist.isPublic && wishlist.userId !== user.id) return 403`).
  - Usar identificadores no predecibles (UUID/CUID) para órdenes en lugar de contadores secuenciales.

---

### [ALTO-02] Control de acceso roto y exposición de credenciales en `/api/live/stream`
- **Clasificación:** CWE-862 / CWE-200 | OWASP A01:2021 (Broken Access Control)
- **Ubicación:** `app/api/live/stream/route.ts` (líneas 30–100) y `lib/live-stream.ts` (líneas 10–15)
- **Descripción:**
  - Tanto `GET` como `POST /api/live/stream` utilizan `withAuth` en lugar de `withAdminAuth`.
  - `GET` expone la URL RTMP y la clave de ingestión de producción (`streamKey: "live_8f3c1a9d-prod-ingest-key"`) a cualquier usuario autenticado.
  - `POST` permite a cualquier usuario autenticado sobrescribir `liveVideoId` en `StreamConfig`, modificando el contenido embebido en la página pública `/live` (la propia lógica registra `hijacked = user.role !== "ADMIN"` en lugar de denegar la operación).
- **Remediación:**
  - Restringir `GET` y `POST /api/live/stream` con `withAdminAuth` y nunca exponer `streamKey` fuera de entornos administrativos autorizados (idealmente gestionarla como secreto de servidor).

---

### [ALTO-03] Bypass de autorización por cabecera HTTP y rutas internas/sensibles públicas
- **Clasificación:** CWE-290 / CWE-306 / CWE-200 | OWASP A01:2021
- **Ubicaciones:**
  - `app/internal/page.tsx` (líneas 16–21)
  - `app/monitoring/internal-status/page.tsx` (líneas 20–33)
  - `app/api/flags/route.ts`, `app/api/flags/[slug]/route.ts`, `app/api/flags/progress/route.ts`
- **Descripción:**
  - `/internal` únicamente comprueba `headersList.get("x-internal-request") === "true"`. Cualquier cliente externo puede falsificar dicha cabecera directamente (o provocar que el propio servidor la envíe mediante SSRF en `/api/support`).
  - `/monitoring/internal-status` es accesible públicamente sin autenticación y expone versión de Node, plataforma, arquitectura, uptime, uso de memoria, PID y `NODE_ENV`.
  - `/api/flags` y `/api/flags/[slug]` devuelven sin autenticación todos los registros internos de la tabla `flags`.
- **Remediación:**
  - Autenticar todas las rutas administrativas e internas mediante sesiones verificadas en servidor (`cookies()` + `decodeSessionToken` + verificación de rol `ADMIN`), nunca confiando en cabeceras HTTP fácilmente falsificables.
  - Proteger o deshabilitar endpoints de diagnóstico e internos en producción.

---

### [ALTO-04] Hashing de contraseñas con MD5 sin sal, enumeración de usuarios y filtración de hashes
- **Clasificación:** CWE-328 / CWE-916 / CWE-204 | OWASP A02:2021 & A07:2021
- **Ubicaciones:**
  - `lib/server-auth.ts` (líneas 14–16)
  - `app/api/auth/login/route.ts` (líneas 27, 39–48)
  - `app/api/auth/signup/route.ts` (line 46), `app/api/auth/reset-password/route.ts` (línea 46)
  - `prisma/seed.ts` (líneas 576–578, 655–716)
  - `app/news/page.tsx` (líneas 4–17)
- **Descripción:**
  - Las contraseñas se almacenan con MD5 simple sin sal ni estiramiento de clave.
  - En `/api/auth/login`, los mensajes de error difieren entre cuenta inexistente (`"Invalid credentials"`) y contraseña incorrecta (`"Invalid password"`), permitiendo enumeración de correos registrados.
  - `prisma/seed.ts` inicializa cuentas con contraseñas débiles (`admin` para `admin@quokka.store`, `iloveduck`, `qwerty`, `sunshine`), y `app/news/page.tsx` publica hashes MD5 de cuentas reales sembradas (`alice@example.com`, `bob@example.com`).
- **Remediación:**
  - Migrar a `argon2` (`argon2id`) o `bcrypt` (coste >= 12).
  - Unificar el mensaje y código de error en `/api/auth/login` (`"Invalid credentials"` tanto si falta el usuario como si falla la contraseña, realizando una verificación en tiempo constante).
  - Eliminar hashes/credenciales hardcodeadas de vistas públicas y usar contraseñas robustas o rotación obligatoria.

---

### [ALTO-05] Múltiples vulnerabilidades de Cross-Site Scripting (XSS)
- **Clasificación:** CWE-79 | OWASP A03:2021 (Injection)
- **Ubicaciones:**
  1. **XSS Almacenado en reseñas de productos:** `app/products/[id]/ProductDetailClient.tsx` (líneas 51–67) y `app/api/products/[id]/reviews/route.ts` (líneas 41–73). Asigna `reviewElement.innerHTML = review.content` y además clona y ejecuta explícitamente cualquier etiqueta `<script>`. El endpoint `POST` no requiere autenticación y permite falsificar el campo `author`.
  2. **XSS Almacenado en analíticas administrativas:** `app/admin/analytics/AnalyticsClient.tsx` (línea 366) renderiza `visit.ip` con `dangerouslySetInnerHTML={{ __html: visit.ip }}`, mientras `app/api/tracking/route.ts` (líneas 58–59) almacena sin validación el valor de `x-forwarded-for`. Cualquier visitante puede inyectar HTML/JS en la consola de administración.
  3. **XSS Reflejado vía respuesta SSRF en soporte:** `app/support/SupportForm.tsx` (líneas 101–106) inserta `submittedData.screenshotContent` con `dangerouslySetInnerHTML`.
  4. **XSS Almacenado vía subida de SVG:** `app/api/admin/products/[id]/image/route.ts` (línea 14), `app/api/uploads/[...path]/route.ts` (línea 12) y `app/products/[id]/ProductDetailClient.tsx` (líneas 170–182) permiten subir y servir archivos `image/svg+xml` sin sanitización y embebidos con `<object type="image/svg+xml">`, ejecutando scripts en el origen de la aplicación.
- **Remediación:**
  - Renderizar reseñas, direcciones IP y respuestas externas como texto plano en JSX (`{review.content}`, `{visit.ip}`) en lugar de `innerHTML` o `dangerouslySetInnerHTML`.
  - Si se requiere formato enriquecido, usar Markdown seguro (por ejemplo `react-markdown` sin HTML raw) o sanitizar estrictamente con `DOMPurify`.
  - Bloquear la subida de `image/svg+xml` o sanitizar el SVG, servirlo desde un dominio aislado / con `Content-Disposition: attachment` y cabecera `Content-Security-Policy: default-src 'none'; sandbox`.
  - Validar el formato de IP en `/api/tracking` (ej. `net.isIP`) y autenticar la creación de reseñas usando `user.email` desde la sesión en lugar del campo `author` del cliente.

---

### [ALTO-06] Open Redirect en el flujo de inicio de sesión
- **Clasificación:** CWE-601 | OWASP A01:2021
- **Ubicación:** `app/login/LoginForm.tsx` (líneas 16, 36–37)
- **Descripción:**  
  El formulario lee el parámetro `redirect` de la URL y ejecuta `window.location.href = redirect` tras el login sin validar que sea una ruta relativa segura del mismo origen. Esto permite redirecciones a dominios maliciosos de phishing o la ejecución de esquemas como `javascript:`.
- **Remediación:**
  - Validar que `redirect` comience por `/` y no por `//`, `\`, o esquemas (`http:`, `javascript:`, etc.), o usar un mapa/lista blanca de rutas internas permitidas.

---

### [ALTO-07] Server-Side Request Forgery (SSRF) en Soporte y Asistente IA
- **Clasificación:** CWE-918 | OWASP A10:2021 (SSRF)
- **Ubicaciones:**
  - `app/api/support/route.ts` (líneas 14–28) — sin autenticación
  - `app/api/ai-assistant/route.ts` (líneas 63–100, 200–212) — sin autenticación
- **Descripción:**
  - `POST /api/support` ejecuta `fetch(screenshotUrl, { headers: { "X-Internal-Request": "true" } })` con una URL arbitraria controlada por el usuario, devolviendo el contenido de la respuesta al cliente y enviando la cabecera privilegiada `X-Internal-Request: true`.
  - `POST /api/ai-assistant` permite especificar `mcpServerUrl`, provocando que el servidor realice peticiones JSON-RPC (`tools/list` y `tools/call`) hacia destinos internos o externos arbitrarios.
- **Remediación:**
  - Requerir autenticación en ambos endpoints.
  - Para `screenshotUrl`, validar esquema (`https:` únicamente), resolver DNS antes de conectar, bloquear rangos IP privados, loopback y link-local (`127.0.0.0/8`, `10.0.0.0/8`, `169.254.0.0/16`, `::1`, etc.), deshabilitar redirecciones automáticas y no reenviar cabeceras internas.
  - Restringir servidores MCP a una lista blanca administrada en el servidor, nunca a URLs arbitrarias enviadas por el cliente.

---

### [ALTO-08] Condición de carrera (TOCTOU) en la redención de cupones
- **Clasificación:** CWE-362 | OWASP A04:2021 (Insecure Design)
- **Ubicación:** `app/api/orders/route.ts` (líneas 64–88)
- **Descripción:**  
  El endpoint consulta `coupon.usedCount < coupon.maxUses`, introduce una espera artificial (`await new Promise((resolve) => setTimeout(resolve, 150))`) y luego ejecuta `prisma.coupon.update` incrementando `usedCount` sin validar el límite de forma atómica ni envolver la operación en una transacción. Además, si el cupón es inválido o agotado, la orden continúa creándose sin error.
- **Remediación:**
  - Utilizar una actualización condicional atómica dentro de `prisma.$transaction`:  
    `updateMany({ where: { code, usedCount: { lt: coupon.maxUses } }, data: { usedCount: { increment: 1 } } })` (o incrementar en SQL con `WHERE usedCount < maxUses`) verificando `count === 1`, y abortar la creación de la orden si el cupón no es válido.

---

### [ALTO-09] Exposición de contraseñas en logs y credenciales débiles en sistema SIEM
- **Clasificación:** CWE-532 / CWE-798 / CWE-565 | OWASP A09:2021 & A07:2021
- **Ubicaciones:**
  - `app/api/auth/login/route.ts` (líneas 16–25)
  - `app/api/monitoring/auth/route.ts` (líneas 5–21)
  - `app/api/monitoring/logs/route.ts` (líneas 7–26)
- **Descripción:**
  - `POST /api/auth/login` registra en `logs/app.log` las contraseñas en texto plano de cada intento de inicio de sesión (`password=${password}`).
  - La consola SIEM (`/monitoring/siem`, `/api/monitoring/auth`, `/api/monitoring/logs`) utiliza credenciales hardcodeadas triviales (`root` / `admin`) y emite una cookie `siem_session=authenticated` estática, sin firma criptográfica, sin `sameSite` y sin `secure`. Cualquiera puede fijar esa cookie o usar `Basic cm9vdDphZG1pbg==` para leer todos los logs, incluyendo contraseñas en texto plano.
- **Remediación:**
  - Eliminar inmediatamente el registro de `password` (y cualquier secreto o token) de todos los logs.
  - Reemplazar la autenticación SIEM por el sistema de autenticación robusto del administrador (con sesiones firmadas HMAC/JWT, contraseñas fuertes configuradas externamente y cookies `httpOnly`, `secure`, `sameSite: "lax"`).

---

### [ALTO-10] Cifrado sin autenticación (AES-256-CBC) y clave por defecto hardcodeada
- **Clasificación:** CWE-327 / CWE-321 / CWE-209 | OWASP A02:2021
- **Ubicaciones:**
  - `lib/share-crypto.ts` (líneas 3–32)
  - `app/api/documents/share/route.ts` (líneas 13–105)
- **Descripción:**
  - Los tokens de enlaces compartidos usan `aes-256-cbc` sin MAC/HMAC ni modo autenticado, con una clave fallback hardcodeada (`a1b2c3d4...`) cuando `SHARE_ENCRYPTION_KEY` no está definida (no existe en `.env.local` ni `docker-compose.yml`).
  - `/api/documents/share` devuelve mensajes de error distintos según falle el descifrado/padding (`"Invalid share token format"`), falte el delimitador (`"Shared resource not found"`) o cambie el tipo (`"Unsupported resource type '${resourceType}'..."`), exponiendo un oráculo de padding (Padding Oracle) que permite descifrar o forjar tokens (como `report:internal`).
- **Remediación:**
  - Migrar a cifrado autenticado (`aes-256-gcm` con `authTag` verificado) o firmar tokens con HMAC/JWT usando una clave secreta obligatoria inyectada por entorno.
  - Devolver respuestas de error genéricas e idénticas (`400 Bad Request` / `404 Not Found`) ante cualquier fallo del token.

---

### [ALTO-11] Dependencias con vulnerabilidades críticas conocidas
- **Clasificación:** CWE-1395 | OWASP A06:2021 (Vulnerable and Outdated Components)
- **Ubicación:** `package.json` (líneas 32–38)
- **Descripción:**
  - **`next` `15.2.2`**: Versión fijada vulnerable a bypass de middleware (`CVE-2025-29927`, mitigado a partir de 15.2.3) y a vulnerabilidades críticas en React Server Components (`CVE-2025-55182` referenciado incluso en `.env.local` junto a `react@19.2.0`).
  - **`libxmljs2` `0.37.0`**: Binding nativo de `libxml2` sin mantenimiento activo robusto y con historial de vulnerabilidades de memoria y XXE.
- **Remediación:**
  - Actualizar `next`, `react` y `react-dom` a las últimas versiones parcheadas de la rama estable.
  - Reemplazar `libxmljs2` por una alternativa segura y mantenida (p. ej. `fast-xml-parser` con entidades externas deshabilitadas) y ejecutar `npm audit` de forma continua en CI/CD.

---

## 5. Hallazgos Medios

### [MED-01] Generación predecible de códigos de tarjetas regalo y ausencia de cobro
- **Clasificación:** CWE-338 / CWE-840 | OWASP A02:2021 & A04:2021
- **Ubicaciones:**
  - `lib/gift-card.ts` (líneas 5–25)
  - `app/api/gift-cards/route.ts` (líneas 51–58)
  - `app/api/gift-cards/redeem/route.ts` (líneas 32–39)
  - `app/profile/gift-cards/ProfileGiftCardsClient.tsx` (línea 28)
- **Descripción:**
  - `generateGiftCardCode(createdAt.getTime())` utiliza un generador congruencial lineal (LCG) determinista sembrado únicamente con el timestamp en milisegundos, y la interfaz muestra dicho timestamp al milisegundo.
  - `POST /api/gift-cards` emite tarjetas regalo de hasta $500 sin procesar ningún cargo ni descontar saldo al comprador, permitiendo generar crédito ilimitado canjeable desde una segunda cuenta.
  - `POST /api/gift-cards/redeem` descarga todas las tarjetas `PENDING` en memoria en cada petición, creando un riesgo de degradación/DoS con crecimiento de datos.
- **Remediación:**
  - Generar códigos con `crypto.randomInt` / `crypto.randomBytes`.
  - Exigir un flujo de pago verificado antes de activar tarjetas regalo y almacenar un hash del código indexado para búsqueda directa `O(1)` sin cargar toda la tabla.

---

### [MED-02] Exposición de hash de contraseña y diagnósticos internos en `/api/user/export`
- **Clasificación:** CWE-200 / CWE-209 | OWASP A01:2021 & A05:2021
- **Ubicación:** `app/api/user/export/route.ts` (líneas 7, 35–93, 127–142)
- **Descripción:**
  - `ALLOWED_USER_FIELDS` incluye `"password"`, permitiendo exportar el hash almacenado de la contraseña del usuario.
  - Al enviar un campo inválido o producirse una excepción, `getSystemDiagnostics()` devuelve versión de Node, entorno, pila de errores de BD (`stack`) y una consulta a la tabla interna `flags`.
- **Remediación:**
  - Remover `"password"` de `ALLOWED_USER_FIELDS`.
  - Eliminar `getSystemDiagnostics()` de respuestas HTTP orientadas al usuario y registrar errores únicamente en logs internos sanitizados.

---

### [MED-03] Token de diagnóstico hardcodeado y sin control de sesión de usuario
- **Clasificación:** CWE-798 | OWASP A07:2021
- **Ubicación:** `app/api/admin/diag/route.ts` (líneas 5–15)
- **Descripción:**  
  El endpoint valida únicamente un token estático hardcodeado en el código fuente (`DIAG_AUTH_TOKEN = "dbg_8f3a7c91e2b4d6a05e21"`) en la cabecera `x-debug-auth`.
- **Remediación:**
  - Proteger cualquier endpoint administrativo con `withAdminAuth` y eliminar tokens estáticos del código fuente.

---

### [MED-04] Exposición de secretos y falta de exclusión de `.env.local`
- **Clasificación:** CWE-798 / CWE-200 | OWASP A02:2021 & A05:2021
- **Ubicaciones:**
  - `.env.local`, `.gitignore`, `.dockerignore`
  - `app/checkout/CheckoutClient.tsx` (línea 119)
  - `app/api/ai-assistant/route.ts` (línea 22)
- **Descripción:**
  - `.env.local` contiene secretos y no está incluido ni en `.gitignore` ni en `.dockerignore`, por lo que `COPY . .` en `Dockerfile` lo incrusta en la imagen de contenedor.
  - `NEXT_PUBLIC_PAYMENT_SECRET` se compila en el bundle JavaScript público del navegador.
  - `SYSTEM_PROMPT` en `app/api/ai-assistant/route.ts` incrusta un código interno (`QKB{282aa326914e}`).
- **Remediación:**
  - Añadir `.env*` (salvo `.env.example` sin secretos) a `.gitignore` y `.dockerignore`.
  - Nunca prefijar secretos con `NEXT_PUBLIC_`.

---

### [MED-05] Debilidades de diseño en el Asistente IA y servidor MCP
- **Clasificación:** CWE-693 / CWE-798 | OWASP LLM01 / A07:2021
- **Ubicaciones:**
  - `lib/prompt-injection-filter.ts` (líneas 1–10)
  - `lib/mcp-constants.ts` (líneas 1–2)
  - `app/api/mcp/route.ts` (líneas 142–183)
  - `app/api/ai-assistant/route.ts` (líneas 32–33, 161–215)
- **Descripción:**
  - El filtro de prompt injection se basa únicamente en 4 expresiones regulares en inglés fácilmente evadibles.
  - El acceso a la herramienta restringida `get_compliance_report` en `/api/mcp` depende únicamente de la cabecera estática `X-MCP-Session: quokka-internal-agent` (hardcodeada en el repositorio) y de instrucciones en texto dentro del `SYSTEM_PROMPT`.
  - El endpoint `POST /api/ai-assistant` no exige autenticación de usuario.
- **Remediación:**
  - No confiar en el prompt del sistema ni en listas negras de regex como fronteras de autorización; aplicar autorización real basada en roles del usuario autenticado antes de exponer o ejecutar herramientas sensibles en MCP.
  - Sustituir la cabecera estática compartida por tokens de servicio rotables o redes privadas aisladas.

---

### [MED-06] Validación insuficiente de archivos subidos y ejecución como `root` en despliegue
- **Clasificación:** CWE-434 / CWE-250 | OWASP A04:2021 & A05:2021
- **Ubicaciones:**
  - `app/api/admin/products/[id]/image/route.ts` (líneas 64–85)
  - `Dockerfile` (líneas 1–34)
  - `scripts/setup.sh` (línea 53)
- **Descripción:**
  - La subida de imágenes valida únicamente `file.type` (cabecera `Content-Type` controlada por el cliente) sin inspeccionar magic bytes del contenido ni validar la extensión resultante.
  - El `Dockerfile` no especifica una directiva `USER` no privilegiada, ejecutando Next.js y el acceso a SQLite como `root`.
  - `scripts/setup.sh` arranca `npx prisma studio` en el puerto `5555` sin autenticación junto con la aplicación.
- **Remediación:**
  - Verificar la firma binaria (magic bytes) de imágenes rasterizadas (JPEG/PNG/WebP/GIF) y asignar extensiones derivadas del tipo real validado.
  - Añadir un usuario dedicado sin privilegios (`USER node` o `adduser`) en `Dockerfile`.
  - No lanzar Prisma Studio automáticamente en scripts susceptibles de usarse fuera de desarrollo local aislado.

---

### [MED-07] Ausencia de cabeceras de seguridad HTTP y protección CSRF explícita
- **Clasificación:** CWE-352 / CWE-693 | OWASP A05:2021
- **Ubicaciones:**
  - `next.config.ts`
  - `app/api/user/profile/route.ts` (líneas 62–65)
  - `app/api/orders/[id]/route.ts` (líneas 87–90, 182–185)
- **Descripción:**
  - `next.config.ts` no configura cabeceras de defensa en profundidad (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Strict-Transport-Security`).
  - Algunos endpoints mutantes (`POST /api/user/profile`, `POST /api/orders/[id]`) aceptan `application/x-www-form-urlencoded` sin validación de token CSRF ni comprobación de cabecera `Origin`/`Referer`. Además, `GET /api/auth/support-login` altera la sesión mediante un método `GET`.
- **Remediación:**
  - Configurar `headers()` en `next.config.ts` (o en proxy inverso) con una CSP estricta, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`.
  - Exigir verificación de `Origin` o tokens anti-CSRF en operaciones que cambien estado y evitar aceptar formularios URL-encoded innecesariamente.

---

## 6. Plan de Remediación Priorizado

### Fase 1 — Inmediata (Contención Crítica)
1. **Proteger `/api/files`** con `withAdminAuth` y validación estricta de rutas (`path.resolve` + comprobación de prefijo).
2. **Corregir registro y soporte:** eliminar `role` de `signupBodySchema`, restringir `/api/user/support-access` al usuario autenticado y validar `!supportToken.revoked` en `/api/auth/support-login`.
3. **Configurar `JWT_SECRET` obligatorio** de alta entropía y eliminar el fallback `"secret"`.
4. **Eliminar las 4 inyecciones SQL** (`products/search`, `orders/search`, `admin/reviews`, `tracking`) migrando a métodos parametrizados de Prisma.
5. **Deshabilitar XXE** (`noent: false, dtdload: false`) en `import-order/route.ts`.
6. **Recalcular precios y descuentos en el servidor** en `/api/orders` y `/api/coupon/apply`, usando transacciones atómicas para el contador de cupones.
7. **Eliminar contraseñas en texto plano de los logs** en `/api/auth/login` y desactivar las credenciales `root:admin` del SIEM.

### Fase 2 — Corto Plazo (Autenticación, Autorización y XSS)
1. Implementar comprobaciones de propiedad (anti-IDOR) en `/api/orders/[id]`, `/api/wishlists/[id]` y restringir `/api/live/stream` con `withAdminAuth`.
2. Reemplazar MD5 por `argon2id` o `bcrypt`, unificar mensajes de error en login y generar tokens de reset con `crypto.randomBytes(32)`.
3. Eliminar todos los usos de `innerHTML` y `dangerouslySetInnerHTML` (`ProductDetailClient.tsx`, `AnalyticsClient.tsx`, `SupportForm.tsx`), deshabilitar o aislar SVG en subidas y validar redirecciones en `LoginForm.tsx`.
4. Proteger `/internal`, `/monitoring/internal-status`, `/api/flags*` y `/api/admin/diag` con autenticación de administrador real; mitigar SSRF en `/api/support` y `/api/ai-assistant`.
5. Actualizar `next`, `react` y `react-dom` a versiones parcheadas y reemplazar `libxmljs2`.

### Fase 3 — Mediano Plazo (Endurecimiento y Criptografía)
1. Sustituir `aes-256-cbc` en `lib/share-crypto.ts` por `aes-256-gcm` o tokens firmados con clave de entorno obligatoria.
2. Usar `crypto.randomInt` para códigos de gift card e integrar validación de pago real.
3. Excluir `.env*` en `.gitignore` / `.dockerignore`, ejecutar Docker con usuario no `root` y aplicar cabeceras HTTP de seguridad y protección CSRF en `next.config.ts`.
