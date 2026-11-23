# Auditoría de seguridad — Quokka Bazaar (v2.17.0)

**Fecha:** 2026-11-23
**Alcance:** código fuente de `/var/tmp/bench/ws-Ttr9LfDD` (Next.js 15.2.2 + Prisma/SQLite, ~200 ficheros), configuración Docker, dependencias bloqueadas en `package-lock.json`.
**Método:** revisión estática del código (lectura de rutas API, autenticación, middleware, validación, componentes con HTML sin sanear, configuración y secretos). **No se ejecutó la aplicación ni se lanzaron pruebas contra un servidor en marcha**: cada hallazgo indica el fichero y la línea donde está el problema, y la explotabilidad se deduce del código. Conviene confirmar los críticos con pruebas dinámicas antes de dar por cerrados.
**Enmascaramiento:** los valores de secretos y banderas (`QKB{…}`, claves, contraseñas) aparecen truncados en este informe.

> **Nota sobre el contexto:** el proyecto contiene banderas tipo `QKB{…}`, identificadores de "caso" y endpoints de auditoría deliberadamente expuestos. Parece un laboratorio de entrenamiento en seguridad. Si es así, este informe describe las vulnerabilidades que el laboratorio contiene. Si el código alguna vez ha estado desplegado con datos reales, trátese como un incidente.

---

## 1. Resumen ejecutivo

La aplicación tiene **fallos críticos en casi todas sus capas**: autenticación, autorización, inyección SQL, lectura de ficheros, gestión de secretos y lógica de negocio. Un atacante sin cuenta puede, por ejemplo, leer ficheros del servidor, inyectar SQL en dos endpoints públicos, obtener la contraseña de cualquier usuario mediante el token de restablecimiento predecible o forjar una sesión de administrador. Un usuario registrado puede darse de alta como ADMIN, emitir tokens de soporte para cualquier cuenta y generar saldo infinito con tarjetas regalo.

| Severidad | Nº | Significado |
|-----------|----|-------------|
| **Crítica** | 11 | Compromiso total o masivo de datos/cuentas, sin requisitos previos o con una cuenta cualquiera |
| **Alta** | 14 | Compromiso serio de confidencialidad o integridad, o escalada tras un primer paso |
| **Media** | 13 | Debilidades que facilitan los ataques anteriores o afectan a partes limitadas |
| **Baja / informativa** | 7 | Higiene, endurecimiento y observaciones |

**Las 5 acciones más urgentes:**
1. Eliminar el secreto por defecto de JWT y **verificar la firma en el middleware** (C1).
2. Dejar de devolver el `requestedAt` y usar tokens de restablecimiento aleatorios (C2).
3. Quitar la asignación de `role` en el registro y restringir `support-access` al propio usuario (C3, C4).
4. Parametrizar todas las consultas `$queryRawUnsafe` y dejar de loguear contraseñas (C5, C6).
5. Sacar secretos del repositorio y de la imagen Docker, y **rotar todos los que aparecen aquí** (A8).

---

## 2. Tabla de hallazgos

| ID | Sev. | Título | Ubicación principal | Requiere autenticación |
|----|------|--------|---------------------|------------------------|
| C1 | Crítica | Forja de sesión de administrador (secreto JWT `"secret"` por defecto + middleware sin verificar firma) | `lib/server-auth.ts:12`, `middleware.ts:3-30` | No |
| C2 | Crítica | Token de restablecimiento de contraseña predecible; el servidor devuelve el timestamp | `app/api/auth/forgot-password/route.ts:14,22,39-43` | No |
| C3 | Crítica | Toma de cuenta de cualquier usuario mediante `support-access` (email arbitrario) | `app/api/user/support-access/route.ts:58-80` | Sí (cualquier cuenta) |
| C4 | Crítica | Registro con rol arbitrario (auto-asignación de ADMIN) | `app/api/auth/signup/route.ts:59-61`, `lib/validation/schemas/auth.ts:9` | No |
| C5 | Crítica | Contraseñas en claro en los logs, legibles por endpoint protegido con credenciales por defecto | `app/api/auth/login/route.ts:16-25`, `app/api/monitoring/logs/route.ts` | No (con credenciales por defecto) |
| C6 | Crítica | Inyección SQL no autenticada (búsqueda de productos y tracking) | `app/api/products/search/route.ts:93,100`, `app/api/tracking/route.ts:58-59,99,103` | No |
| C7 | Crítica | Lectura arbitraria de ficheros del servidor (path traversal) | `app/api/files/route.ts:17,20,49,53,62` | No |
| C8 | Crítica | Pedidos con total fijado por el cliente y tarjetas regalo sin pago canjeables por saldo | `app/api/orders/route.ts:39,130`, `app/api/gift-cards/route.ts:38-66`, `app/api/gift-cards/redeem/route.ts:70` | Sí |
| C9 | Crítica | IDOR: lectura de cualquier pedido (email, dirección) | `app/api/orders/[id]/route.ts:13-14` | Sí |
| C10 | Crítica | Enlaces de compartir forjables (AES-CBC con clave fija en el código, sin autenticación) | `lib/share-crypto.ts:6-7`, `app/api/documents/share/route.ts` | No |
| C11 | Crítica | XSS almacenado en reseñas (scripts re-ejecutados) | `app/products/[id]/ProductDetailClient.tsx:54-63` | No (escribir reseña también sin login) |
| A1 | Alta | Inyección SQL en búsqueda de pedidos | `app/api/orders/search/route.ts:81,96,102` | Sí |
| A2 | Alta | SSRF con reflexión de la respuesta (`screenshotUrl`) y MCP externo arbitrario | `app/api/support/route.ts:12-21`, `app/api/ai-assistant/route.ts:200-202` | No |
| A3 | Alta | XXE en importación de pedidos de proveedor (`noent`, `dtdload`) | `app/api/admin/suppliers/import-order/route.ts:21-24` | Admin (forjable, ver C1) |
| A4 | Alta | Credenciales SIEM fijas `root/admin` y cookie de sesión estática | `app/api/monitoring/auth/route.ts:5-6,14-16`, `app/api/monitoring/logs/route.ts:7-8,15,21` | No |
| A5 | Alta | Función "restringida" de MCP protegida por una cabecera pública fija | `lib/mcp-constants.ts:1-2`, `app/api/mcp/route.ts:143,181-182` | No |
| A6 | Alta | XSS almacenado en el panel de administración (IP de `X-Forwarded-For`) | `app/admin/analytics/AnalyticsClient.tsx:366`, `app/api/tracking/route.ts:58-59` | No (para inyectar); admin lo ve |
| A7 | Alta | Clave de retransmisión (`streamKey`) visible para cualquier usuario y emisión secuestrable | `lib/live-stream.ts:14`, `app/api/live/stream/route.ts:33,72-76` | Sí |
| A8 | Alta | Secretos versionados y copiados a la imagen Docker | `.env.local`, `supplier-registry.txt`, `public/notice.txt`, `flag.txt`, `.gitignore`, `.dockerignore` | No |
| A9 | Alta | Contraseñas con MD5 sin sal y cuentas por defecto (`admin/admin`) creadas en el primer arranque | `lib/server-auth.ts:14-16`, `prisma/seed.ts:658-713`, `docker-entrypoint.sh` | No |
| A10 | Alta | Autorización de pago decorativa: `X-Payment-Auth` nunca se valida en servidor | `app/checkout/CheckoutClient.tsx:119,140`, `app/api/orders/route.ts` | Sí |
| A11 | Alta | XSS mediante SVG subido como imagen de producto | `app/api/admin/products/[id]/image/route.ts:64`, `app/api/uploads/[...path]/route.ts` | Admin |
| A12 | Alta | `GET /api/flags` expone la tabla completa incluido el valor de cada bandera | `app/api/flags/route.ts:7-13`, `app/api/flags/[slug]/route.ts` | No |
| A13 | Alta | Dependencias con CVEs conocidos (Next 15.2.2, React 19.2.0) | `package-lock.json` | — |
| A14 | Alta | Ausencia de rate limiting en login, recuperación, soporte y canje | Todo el proyecto | — |
| M1 | Media | Cupones reutilizables y descuento no aplicado en servidor | `app/api/coupon/apply/route.ts`, `app/api/orders/route.ts:50-79` | Sí |
| M2 | Media | Códigos de tarjeta regalo predecibles (LCG con semilla = timestamp) | `lib/gift-card.ts:5-24`, `app/api/gift-cards/route.ts:52` | — |
| M3 | Media | Enumeración de cuentas por mensajes distintos | `app/api/auth/login/route.ts:39-47`, `app/api/auth/signup/route.ts:22-27` | No |
| M4 | Media | Open redirect en el login (`window.location.href = redirect`) | `app/login/LoginForm.tsx:16,36-37` | No |
| M5 | Media | Sesiones JWT sin revocación (7 días; soporte 365 días); token de soporte en la URL | `lib/server-auth.ts`, `app/api/auth/support-login/route.ts`, `app/support-login/page.tsx:11,20` | Sí |
| M6 | Media | Tokens de reset y de soporte guardados en claro en la base de datos | `prisma/schema.prisma:186-196,253-261` | — |
| M7 | Media | Filtración de trazas, diagnóstico interno y ruta del servidor en errores | `app/api/user/export/route.ts:35-61,78,130-137`, `app/api/admin/suppliers/import-order/route.ts:32,54,89` | Sí / admin |
| M8 | Media | Asistente IA: filtro de prompt injection trivial y secreto en el prompt de sistema | `lib/prompt-injection-filter.ts:2-5`, `app/api/ai-assistant/route.ts:22` | No |
| M9 | Media | SQL dinámico en el endpoint de revisiones: `db.exec` ejecuta SQL arbitrario | `app/api/admin/reviews/route.ts:103-134` | Admin |
| M10 | Media | Endpoint de diagnóstico con token fijo en el código | `app/api/admin/diag/route.ts:5-6,11-13` | No |
| M11 | Media | XSS reflejado: contenido de una URL arbitraria inyectado con `dangerouslySetInnerHTML` | `app/support/SupportForm.tsx:103-107` | No (requiere enviar el formulario) |
| M12 | Media | Contenedor sin cabeceras de seguridad y como root | `Dockerfile`, `next.config.ts` | — |
| M13 | Media | Reseñas sin autenticación pueden firmar con cualquier autor | `app/api/products/[id]/reviews/route.ts:59-63` | No |
| B1 | Baja | `app.log` sin rotación, leído completo en memoria por cada petición | `app/api/monitoring/logs/route.ts:60` | — |
| B2 | Baja | Logs con PII (emails de destinatarios de tarjetas regalo) | `app/api/gift-cards/route.ts` (logger.info) | — |
| B3 | Baja | Cuenta de soporte: `GET` de tokens sin control de frecuencia | `app/api/user/support-access/route.ts` | Sí |
| B4 | Baja | Nota de desarrollo con un nombre y referencias internas en el HTML | `app/admin/documents/page.tsx:6-12` | — |
| B5 | Baja | Cabeceras de caché `immutable` en `/api/uploads` sin control de acceso | `app/api/uploads/[...path]/route.ts:47` | — |
| B6 | Baja | Error de lógica: `reduce` sin valor inicial en el carrito | `app/api/cart/route.ts:34-36` | — |
| B7 | Baja | Desajuste de versiones: `eslint-config-next` 16.0.6 con Next 15.2.2 | `package.json` | — |

---

## 3. Hallazgos críticos (detalle)

### C1 — Forja de sesión de administrador
- **Dónde:** `lib/server-auth.ts:12` define `JWT_SECRET = process.env.JWT_SECRET || "secret"`. Ni `.env.local`, ni `docker-compose.yml`, ni `docker-entrypoint.sh` definen `JWT_SECRET`, así que en el despliegue por defecto el secreto es `"secret"`.
- **Agravante:** `middleware.ts:3-30` no verifica la firma del token (`decodeJWT` solo hace `atob` y mira `exp`) y decide por `payload.role`. Es decir, cualquier cookie `authToken` con un JSON que diga `role: "ADMIN"` pasa el middleware, aunque ni siquiera haga falta firmarla.
- **Impacto:** cualquiera puede generar una cookie `authToken` válida para `withAdminAuth`, que valida la firma HS256 con `"secret"`. Eso da acceso a todas las rutas `/api/admin/*` (productos, usuarios, pedidos, analíticas, soporte, suministradores).
- **Corrección:**
  - Exigir `JWT_SECRET` al arrancar (fallar si no existe o es corto) y no usar valor por defecto.
  - En `middleware.ts`, verificar la firma (o, mejor, delegar en un único `decodeSessionToken` compartido). Las comprobaciones de rol deben basarse en un token verificado, nunca en un decode sin firma.
  - Considerar un JWT estándar (`jsonwebtoken` ya está en las dependencias) con `alg` fijo.

### C2 — Restablecimiento de contraseña predecible
- **Dónde:** `app/api/auth/forgot-password/route.ts:22` genera `token = md5(email + timestamp)`, donde `timestamp = floor(now/1000)` (línea 15). La respuesta incluye `requestedAt` con milisegundos (líneas 14 y 39-43).
- **Impacto:** el atacante conoce el email de la víctima y el instante exacto de la solicitud, calcula el token y lo envía a `/api/auth/reset-password` para fijar una contraseña nueva. **Toma de cuenta de cualquier usuario, incluidos administradores**, sin acceso al correo.
- **Corrección:** token aleatorio con `crypto.randomBytes(32)`, guardado como hash (SHA-256) y con caducidad; no devolver metadatos de tiempo; invalidar tokens tras uso (ya existe `used`, pero el token es predecible). Ver también M6.

### C3 — Toma de cuenta vía soporte
- **Dónde:** `app/api/user/support-access/route.ts:58` usa `parsed.data?.email || user.email`, es decir, **el email del cuerpo de la petición sin comprobar que coincida con el usuario autenticado**. Después (líneas 69-80) crea un `supportAccessToken` para ese usuario con 365 días de validez.
- **Canje:** `app/api/auth/support-login/route.ts:42-49` convierte ese token en una sesión JWT de un año **con el rol del usuario objetivo** (`role: supportToken.user.role`), sin paso de confirmación.
- **Impacto:** cualquier usuario registrado puede convertirse en cualquier otra cuenta, **también en un administrador**. Como la sesión conserva el rol, la escalada es completa.
- **Corrección:** solo permitir emitir tokens para el propio usuario (ignorar el email del cuerpo o exigir rol ADMIN); no permitir tokens de soporte sobre cuentas con rol ADMIN; caducidad corta; registrar el uso; no poner el token en la URL.

### C4 — Registro con rol arbitrario
- **Dónde:** `app/api/auth/signup/route.ts:59-61` copia `body.role` a `userData.role`. El esquema `lib/validation/schemas/auth.ts:3-9` acepta `role` como cadena libre y usa `.passthrough()`.
- **Impacto:** `POST /api/auth/signup` con `{"email": "...", "password": "...", "role": "ADMIN"}` crea un administrador directamente.
- **Corrección:** eliminar el campo `role` del registro; el rol se asigna siempre en el servidor como `CUSTOMER`. Quitar `.passthrough()` y validar con esquemas estrictos.

### C5 — Contraseñas en los logs y credenciales por defecto de acceso a los logs
- **Dónde:** `app/api/auth/login/route.ts:16-25` escribe en el log la **contraseña en claro** (`password`, y también en el mensaje). `lib/logger.ts` y `instrumentation.node.ts` escriben todo en `logs/app.log`.
- **Acceso:** `app/api/monitoring/logs/route.ts` devuelve ese fichero a quien envíe `Authorization: Basic root:admin` (o la cookie de A4).
- **Impacto:** cada inicio de sesión desde que hay tráfico deja la contraseña legible. Quien acceda a los logs se queda con todas las contraseñas de los usuarios que han entrado.
- **Corrección:** no registrar credenciales nunca (ni en mensajes ni en campos); redactar datos sensibles en el logger (pino `redact`); proteger los logs con autenticación real y fuera de la app pública; rotar las contraseñas ya registradas.

### C6 — Inyección SQL no autenticada
- **Búsqueda de productos:** `app/api/products/search/route.ts:93` interpola `query` directamente en `LIKE '%${query}%'` y lo ejecuta con `$queryRawUnsafe` (línea 100). Como el resultado se devuelve al cliente, se puede **leer cualquier tabla** (usuarios con hashes, tokens de soporte, claves de retransmisión).
- **Tracking:** `app/api/tracking/route.ts:58-59` toma la IP de la cabecera `X-Forwarded-For` (controlada por el cliente) sin escaparla, y la inserta en la línea 99 con `'${ip}'`. `sessionId` también se interpola sin escapar. Las comillas solo se escapan en `userAgent` y `path`. Los errores se silencian (líneas 103-110), lo que permite inferencia ciega.
- **Corrección:** sustituir por consultas parametrizadas (`prisma.product.findMany({ where: { OR: [{ name: { contains: q } }, ...] } })` o `$queryRaw` con plantillas etiquetadas). Eliminar `$queryRawUnsafe` del proyecto. Validar la IP con un parser antes de guardarla.

### C7 — Lectura arbitraria de ficheros
- **Dónde:** `app/api/files/route.ts:17-20` construye `join(baseDir, dirPath)` y `join(baseDir, file)` con parámetros del usuario, sin comprobar que la ruta resultante siga dentro de `documents/`. La lectura se hace en las líneas 49-62 (`readFile`). El esquema `filesQuerySchema` solo valida que sean cadenas.
- **Impacto:** `GET /api/files?file=../.env.local` (o `../flag.txt`, `../supplier-registry.txt`) devuelve el contenido. También permite listar directorios fuera de `documents/`.
- **Corrección:** resolver la ruta con `path.resolve` y exigir que empiece por `baseDir + path.sep`; rechazar `..` y rutas absolutas; usar una lista blanca de ficheros servibles.

### C8 — Pedidos con total manipulable y dinero infinito con tarjetas regalo
- **Total del pedido:** `app/api/orders/route.ts:39` toma `total` del cuerpo y lo guarda tal cual en la línea 130 (`total: total`). El cálculo del cliente (`discountedTotal ?? cartData.total`, `CheckoutClient.tsx`) se envía al servidor. Un cliente puede pedir un carrito de 1.000 € pagando 0,01 €.
- **Tarjetas regalo sin pago:** `app/api/gift-cards/route.ts:38-66` crea tarjetas de 25, 50, 100 o 500 **sin ningún cobro**. `app/api/gift-cards/redeem/route.ts:70` suma el importe al `creditBalance` del usuario que canjea. El único control es que el canjeador no sea el comprador (línea 48), y basta con crear otra cuenta (el registro es libre, ver C4).
- **Impacto:** saldo ilimitado y pedidos a coste cero. Pérdida financiera directa.
- **Corrección:** calcular el total en el servidor a partir de precios de catálogo y cupones validados; integrar el cobro antes de emitir tarjetas; limitar el saldo y auditar canjes; ver también A10.

### C9 — IDOR en lectura de pedidos
- **Dónde:** `app/api/orders/[id]/route.ts:13-14` busca `where: { id }` sin filtrar por `userId`. Se usa `withAuth`, así que cualquier usuario autenticado puede leer cualquier pedido.
- **Impacto:** email del cliente, nombre y dirección de entrega de todos los pedidos. Los identificadores son secuenciales (`ORD-001`, …), lo que facilita enumerarlos.
- **Corrección:** `where: { id, userId: user.id }` salvo que el solicitante sea ADMIN; no usar IDs secuenciales previsibles.

### C10 — Enlaces de compartir forjables
- **Dónde:** `lib/share-crypto.ts:6-7` usa como clave AES-256 un valor por defecto **en el código** (`process.env.SHARE_ENCRYPTION_KEY || "a1b2…"`). El cifrado es AES-256-CBC sin MAC (`lib/share-crypto.ts`), así que no hay integridad. `app/api/documents/share/route.ts` descifra el token **sin autenticación** y devuelve el contenido de `order:<id>` y de `report:internal`.
- **Impacto:** cualquiera puede cifrar `order:<id>` con la clave pública del código y obtener datos de pedidos ajenos, incluido el nombre del cliente y la dirección de entrega. La manipulación por CBC también es posible.
- **Corrección:** clave obligatoria desde el entorno; cifrado autenticado (AES-256-GCM) o tokens firmados con HMAC y caducidad; comprobar en el servidor que quien comparte es el dueño; no tokens permanentes.

### C11 — XSS almacenado en reseñas
- **Dónde:** `app/products/[id]/ProductDetailClient.tsx:54-63` asigna `reviewElement.innerHTML = review.content` y luego **recrea y ejecuta** los `<script>` del contenido. El contenido de la reseña se guarda sin sanear en `POST /api/products/[id]/reviews` y se puede enviar sin cuenta.
- **Impacto:** cualquier visitante de la ficha del producto ejecuta el script del atacante en el origen de la aplicación: robo de sesión (aunque `authToken` es httpOnly, el script puede hacer peticiones autenticadas), cambios de contraseña, o acceso a la sesión de un admin si visita la página.
- **Corrección:** tratar el contenido como texto (React escapa por defecto; no usar `innerHTML`); si hace falta formato, sanear con una lista blanca estricta (p. ej. DOMPurify o Markdown sin HTML). Eliminar la reejecución de scripts. Añadir CSP.

---

## 4. Hallazgos altos (detalle breve)

- **A1 — SQLi autenticada en `app/api/orders/search/route.ts:81,96,102`.** `status` y `user.id` se interpolan en `$queryRawUnsafe`. Aunque requiere sesión, `user.id` viene del JWT, que es forjable (C1). Parametrizar.
- **A2 — SSRF con reflexión.** `app/api/support/route.ts:12-21` hace `fetch(screenshotUrl)` desde el servidor (con cabecera `X-Internal-Request: true`) y **devuelve el cuerpo completo** en `screenshotContent` (línea 36). Puede leer `http://localhost`, redes internas o endpoints de metadatos. `app/api/ai-assistant/route.ts:200-202` hace lo mismo con `mcpServerUrl`, enviado por el cliente. Lista blanca de hosts, bloqueo de IP privadas y sin reflexión de respuestas.
- **A3 — XXE en `app/api/admin/suppliers/import-order/route.ts:21-24`.** `libxmljs.parseXmlString(…, { noent: true, dtdload: true })` resuelve entidades externas: lectura de ficheros locales y SSRF. Es ruta de administrador, pero se alcanza mediante C1. Usar `noent: false`, `dtdload: false` y `nonet: true`.
- **A4 — Credenciales fijas del SIEM.** `app/api/monitoring/auth/route.ts:5-6,14-16` valida `root/admin` y emite la cookie `siem_session=authenticated`, que es un valor fijo. `app/api/monitoring/logs/route.ts:7-8,15,21` acepta la misma cadena en Basic Auth o cookie. Cualquiera que conozca los valores por defecto (o los lea del repositorio) accede. Eliminar; usar un sistema de autenticación real y no exponer el panel de logs.
- **A5 — Función MCP "restringida" sin control real.** `lib/mcp-constants.ts:1-2` define `X-MCP-Session: quokka-internal-agent` como valor público. `app/api/mcp/route.ts:143,181-182` decide acceso por esa cabecera, que cualquier cliente puede enviar. La herramienta `get_compliance_report` devuelve un código de verificación (la bandera de una de las pruebas). Usar credenciales por cliente, nunca un valor constante en el código.
- **A6 — XSS almacenado en el panel de administración.** `app/admin/analytics/AnalyticsClient.tsx:366` renderiza `visit.ip` con `dangerouslySetInnerHTML`. La IP llega de `X-Forwarded-For` sin validar (`app/api/tracking/route.ts:58-59`), así que cualquier visitante puede guardar HTML que se ejecuta en el navegador del administrador. Sustituir por texto y validar la IP.
- **A7 — Clave de retransmisión expuesta y secuestro de la emisión.** `lib/live-stream.ts:12-14` define `streamKey` y `rtmpUrl`. `app/api/live/stream/route.ts:33` devuelve la configuración completa (incluida la clave) a **cualquier usuario autenticado**. Además, en `POST` (líneas 72-76) un no administrador puede cambiar `liveVideoId`; el flag `hijacked` solo es una etiqueta, no bloquea la escritura. Quitar la clave de la respuesta, rotarla y restringir el `POST` a administradores.
- **A8 — Secretos versionados y en la imagen.**
  - `.env.local` contiene `NEXT_PUBLIC_PAYMENT_SECRET` y una bandera. Las variables `NEXT_PUBLIC_*` se incluyen en el bundle del navegador (`CheckoutClient.tsx:119`), así que el secreto es público.
  - `.gitignore` solo ignora `.env` exacto; `.env.local` **no está excluido**. `.dockerignore` tampoco lo excluye, y el `Dockerfile` hace `COPY . .`: el fichero queda en la imagen.
  - `supplier-registry.txt` tiene una `api_key` (valor enmascarado) y un endpoint interno.
  - `public/notice.txt` está en `public/`, así que se sirve por HTTP sin autenticación.
  - `flag.txt` está en la raíz y es leíble vía C7.
  - **Acción:** rotar todas las claves y banderas que aparecen en el código, eliminar los ficheros del repositorio y del historial de git (`git filter-repo`), añadir `.env*` a `.gitignore` y `.dockerignore`, e inyectar secretos en tiempo de ejecución.
- **A9 — MD5 sin sal y cuentas por defecto.** `lib/server-auth.ts:14-16` usa MD5 para contraseñas (en login, registro y restablecimiento: `login/route.ts:27`, `signup/route.ts:46`, `reset-password/route.ts:46`). `prisma/seed.ts:658-713` crea usuarios con contraseñas triviales (`admin`, `qwerty`, `sunshine`, `iloveduck`), y `docker-entrypoint.sh` ejecuta el seed en el primer arranque. Migrar a `argon2` o `bcrypt` con sal, forzar cambio de contraseña y no sembrar cuentas con contraseñas conocidas en producción.
- **A10 — Autorización de pago decorativa.** `CheckoutClient.tsx:119,140` envía `X-Payment-Auth` con el valor de `NEXT_PUBLIC_PAYMENT_SECRET`, pero `app/api/orders/route.ts` nunca lee esa cabecera. No hay pasarela de pago real: cualquier pedido se marca como `PENDING` sin cobro (ver C8).
- **A11 — SVG como imagen de producto.** `app/api/admin/products/[id]/image/route.ts:64` acepta `image/svg+xml` según `file.type` (valor enviado por el cliente, sin comprobar contenido). `app/api/uploads/[...path]/route.ts` lo sirve con ese tipo desde el mismo origen, así que un SVG con `<script>` se ejecuta al abrirlo. Quitar SVG o sanearlo; comprobar firma binaria; servir con `Content-Disposition: attachment` y `X-Content-Type-Options: nosniff`.
- **A12 — Banderas expuestas por API pública.** `app/api/flags/route.ts:7-13` devuelve `prisma.flag.findMany()` completo, incluido el campo `flag` (el valor secreto). `app/api/flags/[slug]/route.ts` hace lo mismo por slug. Filtrar campos y restringir a usuarios que hayan resuelto la prueba, si es un laboratorio.
- **A13 — Dependencias vulnerables (verificar con `npm audit`).** `package-lock.json` fija `next@15.2.2` y `react@19.2.0`. Según mi conocimiento, Next 15.2.2 está afectado por **CVE-2025-29927** (omisión del middleware mediante la cabecera `x-middleware-subrequest`), relevante aquí porque el middleware es la puerta de acceso a `/monitoring/internal-status`; y la combinación Next 15.x / React 19.2.0 entra en el rango de **CVE-2025-55182** (RCE en React Server Components). No he podido comprobarlo sin acceso a la base de datos de vulnerabilidades: ejecutar `npm audit` y actualizar a versiones corregidas.
- **A14 — Sin rate limiting.** No hay limitación de peticiones en ninguna ruta (buscado en todo `app/`, `lib/` y `middleware.ts`). Afecta a login, recuperación de contraseña, `support-login`, canje de tarjetas (fuerza bruta de códigos) y la API de IA. Añadir límites por IP y por cuenta.

---

## 5. Hallazgos medios

- **M1 — Cupones.** `app/api/coupon/apply/route.ts` no incrementa `usedCount` y solo devuelve el descuento calculado en el cliente. En `app/api/orders/route.ts:72-79` el uso se incrementa después de una espera de 150 ms sin transacción: hay una condición de carrera (TOCTOU) que permite reutilizar cupones de un solo uso. Mover la validación y el incremento a una transacción atómica.
- **M2 — Códigos de tarjeta predecibles.** `lib/gift-card.ts:5-24` genera el código con un LCG de 31 bits cuya semilla es el timestamp en milisegundos (`app/api/gift-cards/route.ts:52`). Con el instante de creación se reproduce el código. Usar `crypto.randomBytes` y un código de al menos 80 bits.
- **M3 — Enumeración de cuentas.** `app/api/auth/login/route.ts:39-47` distingue "Invalid credentials" de "Invalid password", y el registro responde 409 con "Email already registered". Responder con un mensaje genérico.
- **M4 — Open redirect.** `app/login/LoginForm.tsx:16,36-37` hace `window.location.href = redirect` con el parámetro de la URL. Acepta URLs externas y `javascript:`. Validar que sea una ruta relativa interna.
- **M5 — Sesiones.** El JWT de 7 días (y de 365 días para soporte) no puede revocarse; el logout solo borra la cookie (`app/api/auth/logout`). El token de soporte viaja en la query string (`app/support-login/page.tsx:11,20`), lo que deja rastro en logs y en cabeceras `Referer`. Añadir un `jti` revocable y tokens de soporte de uso único.
- **M6 — Tokens en claro.** `prisma/schema.prisma:186-196` (`SupportAccessToken.token @unique`) y `:253-261` (`PasswordResetToken.token @unique`) guardan los tokens sin hash. Quien lea la base de datos puede usarlos. Guardar solo su hash.
- **M7 — Información en errores.** `app/api/user/export/route.ts:35-61,78,130-137` devuelve a cualquier usuario autenticado trazas de pila, versiones y valores de banderas en los errores. `app/api/admin/suppliers/import-order/route.ts:32,54,89` devuelve la ruta interna del registro y el mensaje de error del parser. Respuestas genéricas y registro interno solo en servidor.
- **M8 — Asistente IA.** `lib/prompt-injection-filter.ts:2-5` son cuatro expresiones regulares que se evaden fácilmente (sinónimos, idiomas, separadores). `app/api/ai-assistant/route.ts:22` incluye en el prompt de sistema un "código de validación interno", que puede extraerse por prompt injection. Las salidas de las herramientas se tratan como confiables. No poner secretos en el prompt; tratar las salidas de herramientas como no confiables.
- **M9 — Revisiones de administrador con SQL dinámico.** `app/api/admin/reviews/route.ts:103-134` interpola `author` en SQL y lo ejecuta con `db.exec(query)` (línea 120), que admite varias sentencias. Es ruta de admin, pero si C1 se explota, permite escritura arbitraria en la base de datos. Usar consultas preparadas y eliminar `db.exec`.
- **M10 — Token de diagnóstico fijo.** `app/api/admin/diag/route.ts:5-6` compara la cabecera `x-debug-auth` con un valor en el código; devuelve el identificador de build. Eliminar la ruta en producción.
- **M11 — XSS reflejado en el formulario de soporte.** `app/support/SupportForm.tsx:103-107` renderiza `screenshotContent` (la respuesta de una URL arbitraria, ver A2) con `dangerouslySetInnerHTML`. Un atacante puede alojar HTML con scripts y conseguir que alguien lo envíe. Quitar el HTML o sanear.
- **M12 — Contenedor y cabeceras.** El `Dockerfile` no define `USER` (corre como root). `next.config.ts` no define cabeceras de seguridad (CSP, `X-Frame-Options`, `Strict-Transport-Security`, `X-Content-Type-Options`). Añadir `USER node`, cabeceras en `next.config.ts` y un límite de tamaño de petición.
- **M13 — Autor de reseñas suplantable.** `app/api/products/[id]/reviews/route.ts:59-63` toma `author` del cuerpo cuando se envía, incluso sin sesión. Usar siempre el usuario autenticado, o marcar la reseña como anónima.

---

## 6. Baja e informativa

- **B1** `app/api/monitoring/logs/route.ts:60` lee todo `app.log` en memoria en cada petición; sin rotación, puede agotar la memoria o el disco.
- **B2** `app/api/gift-cards/route.ts` registra el email del destinatario (`logger.info`). Es PII en los logs.
- **B3** `GET /api/user/support-access` devuelve el token completo a quien lo pida; mostrarlo solo una vez en la creación.
- **B4** `app/admin/documents/page.tsx:6-12` incluye en el HTML una nota de desarrollo con un nombre y referencias a un registro interno. Quitarla.
- **B5** `app/api/uploads/[...path]/route.ts:47` sirve con `immutable` y sin control de acceso. Correcto para imágenes de producto, pero con A11 conviene limitarlo.
- **B6** `app/api/cart/route.ts:34-36` llama a `reduce` sin valor inicial. Con carrito vacío lanza `TypeError` (error 500). Es un bug funcional, no de seguridad.
- **B7** `package.json` mezcla `eslint-config-next` 16.0.6 con Next 15.2.2. Alinear versiones.

---

## 7. Lo que está bien o no se ha encontrado

- Las consultas Prisma sin `Unsafe` (la mayoría de rutas) usan parámetros y no presentan inyección.
- El canje de tarjetas compara códigos con `timingSafeEqual` (`gift-cards/redeem/route.ts:13-21`), aunque la lógica de canje en sí tenga problemas (C8, M2).
- Las rutas de administración usan `withAdminAuth` de forma consistente (la protección falla por la base común, C1, no por omisiones).
- La cookie `authToken` es `httpOnly`, `sameSite: lax` y `secure` en producción (`lib/server-auth.ts`).
- La ruta `/api/uploads` impide `..` y bytes nulos (`app/api/uploads/[...path]/route.ts:22`). Esa protección no existe en `/api/files` (C7).
- No se encontraron `eval`, `child_process` ni `exec` con entrada del usuario.

---

## 8. Plan de remediación sugerido

**Fase 0 — Inmediata (horas):**
1. Rotar todos los secretos que aparecen en el repositorio: `JWT_SECRET` (definirlo), clave de compartir, clave de retransmisión, `NEXT_PUBLIC_PAYMENT_SECRET`, `api_key` de proveedor y las credenciales `root/admin`.
2. Desactivar en producción: `/api/files`, `/api/monitoring/*`, `/api/admin/diag`, `/api/mcp` (la herramienta de compliance), `/api/admin/reviews`, `/api/flags*`.
3. Eliminar del registro de logs las contraseñas y purgar `logs/app.log`.
4. Quitar `role` del registro (C4) y limitar `support-access` al propio usuario (C3).

**Fase 1 — Autenticación y autorización (1-2 semanas):**
5. Un único verificador de sesión, con firma obligatoria, usado en middleware y en rutas (C1).
6. Restablecimiento con tokens aleatorios y hash en base de datos (C2, M6).
7. Contraseñas con argon2/bcrypt (A9). Rate limiting (A14).
8. IDOR en pedidos y en tokens de compartir (C9, C10).

**Fase 2 — Inyección y entrada (2-3 semanas):**
9. Eliminar `$queryRawUnsafe` y `db.exec` (C6, A1, M9).
10. Corregir la lectura de ficheros (C7), SSRF (A2) y XXE (A3).
11. Sanear HTML en reseñas, panel de admin, soporte y SVG (C11, A6, M11, A11).

**Fase 3 — Lógica de negocio (2-3 semanas):**
12. Total de pedido calculado en servidor; pasarela de pago real (C8, A10).
13. Tarjetas regalo con cobro, códigos aleatorios y canje atómico (C8, M2, M1).
14. Clave de retransmisión fuera de la API y emisión solo para administradores (A7).

**Fase 4 — Endurecimiento (continuo):**
15. Actualizar Next y React a versiones corregidas tras `npm audit` (A13).
16. Cabeceras de seguridad, CSP, usuario no root, límites de tamaño y revisión de logs (M12, B1, B2).
17. Pruebas automáticas de regresión sobre estos casos y revisión de dependencias en CI.

---

## 9. Limitaciones de esta auditoría

- **Revisión estática.** No se ejecutó la aplicación, no se probó ningún exploit y no se consultaron bases de vulnerabilidades en línea. Las severidades son estimaciones a partir del código.
- **Cobertura parcial.** Se revisaron en detalle las rutas de API, la autenticación, el middleware, la validación, la configuración Docker y los componentes con HTML sin sanear. No se leyeron línea a línea todos los componentes de cliente (por ejemplo, la cesta de compra, wishlists, páginas de gestión), ni todo el seed ni todo el esquema.
- **Dependencias.** Los CVE citados en A13 se mencionan de memoria; hay que confirmarlos con `npm audit` y la fuente oficial.
- **Historial de git.** El directorio no es un repositorio git, así que no pude comprobar si los secretos llegaron a un commit. Hay que tratarlos como comprometidos.

---

*Documento generado a partir de la revisión estática del código del proyecto.*
