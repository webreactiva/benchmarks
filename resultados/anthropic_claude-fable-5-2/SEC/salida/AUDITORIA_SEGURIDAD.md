# Auditoría de seguridad — Quokka Bazaar 2.17.0

**Fecha:** 2026-11-24
**Alcance:** todo el repositorio (Next.js 15.2.2 App Router, Prisma + SQLite, 52 rutas API, páginas, configuración Docker, dependencias).
**Método:** revisión estática manual de todo el código de servidor y de los puntos sensibles del cliente, más `npm audit` sobre el lockfile. **No se levantó la aplicación ni se ejecutó ningún exploit**; los hallazgos se deducen del código y cada uno cita el archivo y la línea.

## Veredicto

La aplicación **no es apta para exponerse a Internet ni para manejar datos reales**. Un atacante sin cuenta puede, por varias vías independientes, convertirse en administrador, leer cualquier archivo del servidor, volcar la base de datos y, por la versión de Next.js, ejecutar código en el servidor.

El repositorio contiene una tabla `flags`, pistas, archivos `flag.txt` y cadenas `QKB{…}` repartidas por el código: todo indica que es una aplicación **deliberadamente vulnerable** (laboratorio/CTF). Si es así, los hallazgos son el comportamiento esperado y este informe sirve como mapa; si alguna parte se va a reutilizar en un producto real, aplica todo lo que sigue.

| Severidad | Hallazgos |
|---|---|
| Crítica | 11 |
| Alta | 13 |
| Media | 10 |
| Baja | 6 |

## Resumen de hallazgos

| ID | Sev. | Hallazgo | Ubicación | Requiere |
|---|---|---|---|---|
| C-01 | Crítica | Secreto JWT por defecto `"secret"`: se puede falsificar cualquier sesión | `lib/server-auth.ts:12` | nada |
| C-02 | Crítica | Registro acepta `role`: alta directa como ADMIN | `app/api/auth/signup/route.ts:59` | nada |
| C-03 | Crítica | Token de reseteo predecible (`md5(email + segundos)`) | `app/api/auth/forgot-password/route.ts:22` | nada |
| C-04 | Crítica | Token de «acceso de soporte» emitible para cualquier usuario | `app/api/user/support-access/route.ts:58` | cuenta |
| C-05 | Crítica | Lectura de archivos arbitrarios y listado de directorios | `app/api/files/route.ts:20,49` | nada |
| C-06 | Crítica | Inyección SQL en búsqueda de productos | `app/api/products/search/route.ts:93` | nada |
| C-07 | Crítica | Inyección SQL en tracking (cabecera `X-Forwarded-For`, `sessionId`) | `app/api/tracking/route.ts:99` | nada |
| C-08 | Crítica | SIEM: credenciales `root/admin` y cookie de sesión constante; los logs guardan contraseñas en claro | `app/api/monitoring/logs/route.ts:7-23`, `app/api/auth/login/route.ts:16-25` | nada |
| C-09 | Crítica | Next.js 15.2.2: RCE en el protocolo Flight de React y bypass de middleware | `package.json:33` | nada |
| C-10 | Crítica | Contraseñas con MD5 sin sal, credenciales por defecto y hashes publicados | `lib/server-auth.ts:14`, `prisma/seed.ts:709`, `app/news/page.tsx:7-11` | nada |
| C-11 | Crítica | Total del pedido lo fija el cliente | `app/api/orders/route.ts:130` | cuenta |
| A-01 | Alta | Inyección SQL en búsqueda de pedidos | `app/api/orders/search/route.ts:81` | cuenta |
| A-02 | Alta | Inyección SQL con sentencias apiladas en auditoría de reseñas | `app/api/admin/reviews/route.ts:113-120` | admin |
| A-03 | Alta | SSRF con respuesta devuelta al atacante | `app/api/support/route.ts:16` | nada |
| A-04 | Alta | XXE en importación de pedidos de proveedor | `app/api/admin/suppliers/import-order/route.ts:21` | admin |
| A-05 | Alta | XSS almacenado en reseñas (re-ejecuta `<script>`) | `app/products/[id]/ProductDetailClient.tsx:55` | nada |
| A-06 | Alta | XSS almacenado en panel de analítica vía IP falsificada | `app/admin/analytics/AnalyticsClient.tsx:366` | nada |
| A-07 | Alta | IDOR: cualquier usuario lee cualquier pedido y lista de deseos | `app/api/orders/[id]/route.ts:12`, `app/api/wishlists/[id]/route.ts:10` | cuenta |
| A-08 | Alta | Enlaces compartidos: clave AES embebida, sin autenticación del cifrado | `lib/share-crypto.ts:6-9` | nada |
| A-09 | Alta | Códigos de tarjeta regalo predecibles (LCG sembrado con la hora) | `lib/gift-card.ts:5-16`, `app/api/gift-cards/route.ts:52` | cuenta |
| A-10 | Alta | Control de acceso solo en middleware, que además no verifica la firma | `middleware.ts:3-20`, `app/monitoring/internal-status/page.tsx` | nada |
| A-11 | Alta | Asistente IA: servidor MCP elegido por el usuario (SSRF + envenenamiento de herramientas), secretos en el prompt | `app/api/ai-assistant/route.ts:22,200-208` | nada |
| A-12 | Alta | Secretos en el repositorio, en la imagen Docker y en el bundle del cliente | `.env.local`, `.gitignore`, `.dockerignore`, `app/checkout/CheckoutClient.tsx:119` | — |
| A-13 | Alta | Emisión en directo modificable por cualquier usuario; clave de stream expuesta | `app/api/live/stream/route.ts:30,56` | cuenta |
| M-01 | Media | Redirección abierta y XSS por `javascript:` tras el login | `app/login/LoginForm.tsx:37` | interacción |
| M-02 | Media | Página `/internal` protegida por una cabecera que el cliente controla | `app/internal/page.tsx:17-20` | nada |
| M-03 | Media | Servidor MCP sin autenticación; «sesión» es una constante del código | `app/api/mcp/route.ts:181`, `lib/mcp-constants.ts` | nada |
| M-04 | Media | Exportación de datos devuelve el hash de contraseña y filtra diagnósticos | `app/api/user/export/route.ts:7,77-91` | cuenta |
| M-05 | Media | Condición de carrera en cupones; el descuento no se valida en servidor | `app/api/orders/route.ts:64-80` | cuenta |
| M-06 | Media | Subida de SVG servida desde el mismo origen | `app/api/admin/products/[id]/image/route.ts:14`, `app/api/uploads/[...path]/route.ts:12` | admin |
| M-07 | Media | Sesiones: sin revocación, rol no revalidado, `exp` opcional, soporte de 365 días | `lib/server-auth.ts:41-51`, `app/api/auth/support-login/route.ts:35-48` | — |
| M-08 | Media | Sin límite de intentos; enumeración de usuarios | `app/api/auth/login/route.ts:39-47`, `signup/route.ts:22` | nada |
| M-09 | Media | Endpoint `/api/flags` público devuelve la tabla completa de secretos | `app/api/flags/route.ts`, `app/api/flags/[slug]/route.ts` | nada |
| M-10 | Media | HTML remoto inyectado en el formulario de soporte | `app/support/SupportForm.tsx:103` | interacción |
| B-01 | Baja | Token de diagnóstico embebido | `app/api/admin/diag/route.ts:6` | — |
| B-02 | Baja | Sin cabeceras de seguridad (CSP, HSTS, X-Frame-Options…) | `next.config.ts` | — |
| B-03 | Baja | Contenedor ejecuta como root con toolchain de compilación | `Dockerfile` | — |
| B-04 | Baja | URL compartida construida con `Host` / `X-Forwarded-Proto` del cliente | `app/api/orders/[id]/share/route.ts:21-23` | — |
| B-05 | Baja | Suplantación de autor en reseñas; reseñas anónimas sin límite | `app/api/products/[id]/reviews/route.ts:60-63` | nada |
| B-06 | Baja | Mensajes de error con rutas internas y detalle del parser | `import-order/route.ts:32,89`, `documents/share/route.ts:38` | — |

---

## Hallazgos críticos

### C-01 · Secreto JWT por defecto
`lib/server-auth.ts:12` usa `process.env.JWT_SECRET || "secret"`. Ni `docker-compose.yml` ni `.env.local` definen `JWT_SECRET`, así que en el despliegue documentado **el secreto efectivo es `secret`**. Cualquiera puede firmar un token `{"id":…, "role":"ADMIN"}` y pasar `withAdminAuth`.

Agravantes en el mismo archivo: la firma se compara con `!==` (no en tiempo constante, línea 41), `exp` solo se comprueba si existe (línea 49) y no se valida la cabecera del token.

**Corrección:** exigir `JWT_SECRET` al arrancar (fallar si falta o tiene menos de 32 bytes aleatorios), usar `jsonwebtoken` —ya está en dependencias y no se usa— con `algorithms: ["HS256"]`, y hacer obligatorio `exp`.

### C-02 · Asignación masiva de rol en el registro
`signupBodySchema` declara `role` y usa `.passthrough()` (`lib/validation/schemas/auth.ts:3-9`); la ruta lo copia tal cual a la base de datos (`signup/route.ts:59-61`). `POST /api/auth/signup` con `"role":"ADMIN"` crea un administrador.

**Corrección:** quitar `role` del esquema, usar `.strict()` y fijar siempre `CUSTOMER` en servidor.

### C-03 · Token de reseteo de contraseña predecible
El token es `md5(email + timestamp_en_segundos)` (`forgot-password/route.ts:15,22`) y la respuesta devuelve `requestedAt` con la hora exacta (línea 42). El atacante pide el reseteo para `admin@quokka.store`, calcula el token y cambia la contraseña en `/api/auth/reset-password`. Toma de cualquier cuenta sin autenticación.

**Corrección:** `crypto.randomBytes(32)`, guardar solo su hash, no devolver la marca de tiempo, caducidad corta, e invalidar las sesiones al cambiar la contraseña.

### C-04 · Suplantación mediante «acceso de soporte»
`POST /api/user/support-access` toma `email` del cuerpo (`route.ts:58`) y emite un token para **ese** usuario, devolviéndolo al solicitante. `GET /api/auth/support-login?token=…` lo canjea por una sesión completa de la víctima, de 365 días. Además `support-login` no comprueba `revoked` (`support-login/route.ts:28-40`), por lo que revocar no sirve de nada.

**Corrección:** emitir solo para `user.id` de la sesión, comprobar `revoked`, token de un solo uso y vida corta, sesión resultante limitada (minutos/horas) y de alcance reducido. El canje por `GET` también permite forzar a una víctima a iniciar sesión en una cuenta ajena; pasarlo a `POST`.

### C-05 · Lectura de archivos arbitrarios
`/api/files` no tiene autenticación y concatena `file` y `path` con `join(baseDir, …)` sin normalizar ni comprobar que el resultado quede dentro de `documents/` (`route.ts:20,49`). `?file=../.env.local`, `?file=../logs/app.log`, `?file=../prisma/seed.ts` o `?list=true&path=../..` devuelven secretos, logs con contraseñas, el código y el listado del sistema de archivos. Alcanza rutas absolutas como `../../etc/passwd`.

**Corrección:** exigir sesión de administrador, resolver con `path.resolve` y rechazar si no empieza por `baseDir + path.sep` (y comprobar con `realpath` para enlaces simbólicos). El nombre de archivo también se inserta sin escapar en `Content-Disposition` (línea 57).

### C-06 / C-07 · Inyección SQL sin autenticación
- **Productos** (`products/search/route.ts:93`): `q` se interpola en `LIKE '%${query}%'` y se ejecuta con `$queryRawUnsafe`. Un `UNION SELECT` vuelca `users` (email y hash), `support_access_tokens`, `password_reset_tokens`, etc.
- **Tracking** (`tracking/route.ts:99`): `userAgent` y `path` se escapan, pero `ip` (cabecera `X-Forwarded-For`) y `sessionId` no. Permite inyección en un `INSERT`, es decir, escritura controlada y extracción a ciegas.

El filtro que descarta valores que contienen `qkb{` es cosmético: se evita con `hex()`, `substr()` o `replace()`.

**Corrección:** consultas parametrizadas (`prisma.$queryRaw` con plantilla etiquetada o el API de Prisma). No confiar en `X-Forwarded-For` salvo detrás de un proxy propio.

### C-08 · SIEM abierto y contraseñas en claro en los logs
- Credenciales fijas `root` / `admin` duplicadas en `monitoring/auth/route.ts:5-6` y `monitoring/logs/route.ts:7-8`.
- La «sesión» es la cookie `siem_session=authenticated` (`logs/route.ts:20-23`): un valor constante que cualquiera puede enviar **sin conocer la contraseña**.
- El login registra email y contraseña en claro en cada intento (`auth/login/route.ts:16-25`), y esos logs son justo lo que sirve `/api/monitoring/logs`.

Resultado: un anónimo lee las contraseñas de todo el que inicia sesión. `logs/app.log` también es legible por C-05.

**Corrección:** no registrar nunca contraseñas; poner el SIEM detrás de la autenticación de administrador real; purgar los logs existentes y forzar cambio de contraseñas.

### C-09 · Next.js 15.2.2 vulnerable
`npm audit --omit=dev` informa **21 vulnerabilidades (2 críticas, 11 altas, 8 moderadas)**. Las relevantes:
- **RCE no autenticada en el protocolo Flight de React Server Components** (GHSA-9qr9-h5gf-34mp; `react`/`react-dom` 19.2.0 afectados). El propio `.env.local` nombra una variable `FLAG_CVE_2025_55182`.
- **Bypass de autorización en middleware** (GHSA-f82v-jwr5-mffw): la cabecera `x-middleware-subrequest` salta `middleware.ts`, única protección de `/monitoring/internal-status` (ver A-10).
- Varias de SSRF, envenenamiento de caché y DoS en `next`; además `tar` (crítica, transitiva), `prisma`/`@prisma/config` (alta) y `zod` < 4.6.6 (alta, agotamiento de memoria).

**Corrección:** actualizar `next` a la última 15.x parcheada (o superior) junto con `react`/`react-dom`, y ejecutar `npm audit fix`. `eslint-config-next` está en 16.0.6, desalineado con `next` 15.

### C-10 · Almacenamiento de contraseñas y credenciales por defecto
- MD5 sin sal (`lib/server-auth.ts:14`) para todas las contraseñas.
- El seed crea `admin@quokka.store` con contraseña `admin` y usuarios con `qwerty`, `sunshine`, `iloveduck` (`prisma/seed.ts:658-713`); el seed se ejecuta automáticamente en el primer arranque del contenedor.
- La página de login muestra credenciales válidas (`app/login/LoginForm.tsx:60-64`) y `/news` publica hashes MD5 reales de usuarios (`app/news/page.tsx:7-11`).
- El servidor no impone ninguna política de contraseña en el registro (el mínimo de 6 solo existe en el cliente).

**Corrección:** argon2id o bcrypt con migración al iniciar sesión, eliminar cuentas por defecto fuera de desarrollo, validar la contraseña en servidor.

### C-11 · Manipulación del precio
`POST /api/orders` guarda el `total` que envía el navegador (`orders/route.ts:39,130`); solo se exige que sea positivo. Se puede comprar todo el carrito por `0.01`. La factura PDF se genera con ese total. La cabecera `X-Payment-Auth` que envía el cliente no se comprueba en ningún sitio.

**Corrección:** recalcular el total en servidor a partir del carrito y del cupón, dentro de una transacción.

---

## Hallazgos altos

### A-01 · SQLi en búsqueda de pedidos
`orders/search/route.ts:81`: `status` se interpola en `AND o.status = '${status}'`. Cualquier usuario autenticado elimina el filtro por `userId` (`' OR 1=1 --`) o hace `UNION` contra otras tablas.

### A-02 · SQLi con sentencias apiladas (admin)
`admin/reviews/route.ts:113-120` interpola `author` y lo ejecuta con `better-sqlite3` `db.exec()`, que admite **varias sentencias**: permite `UPDATE`/`DROP`/`ATTACH DATABASE` (escritura de archivos). Requiere admin, pero admin se obtiene por C-01 a C-04.

### A-03 · SSRF en soporte
`POST /api/support` (sin autenticación) hace `fetch(screenshotUrl)` y devuelve el cuerpo (`support/route.ts:16-21`). Permite leer servicios internos, metadatos de nube y puertos locales. Además añade `X-Internal-Request: true`, que es justo la «credencial» de `/internal` (M-02).

**Corrección:** eliminar la descarga en servidor o restringir a `https`, lista de hosts permitidos, resolución DNS con bloqueo de rangos privados/loopback/link-local y sin seguir redirecciones.

### A-04 · XXE
`libxmljs.parseXmlString(rawXml, { noent: true, dtdload: true })` (`import-order/route.ts:21-24`) expande entidades externas; el contenido se devuelve en `notes`. Lee archivos locales (el mensaje de error incluso da la ruta de `supplier-registry.txt`, línea 32) y permite SSRF y «billion laughs».

**Corrección:** `noent: false`, `dtdload: false`, `nonet: true`; limitar tamaño del cuerpo.

### A-05 · XSS almacenado en reseñas
El cliente asigna `review.content` a `innerHTML` y recrea los `<script>` para que se ejecuten (`ProductDetailClient.tsx:50-58`). Publicar reseñas no requiere cuenta. La cookie es `httpOnly`, pero el script puede actuar con la sesión de la víctima (por ejemplo C-04 o cambiar el perfil) y leer `localStorage`, donde el chat guarda la clave de API de Mistral (`AIAssistantChat.tsx:44`).

### A-06 · XSS almacenado contra administradores
`visit.ip` se pinta con `dangerouslySetInnerHTML` (`AnalyticsClient.tsx:366`) y procede de `X-Forwarded-For` en `/api/tracking`, sin autenticación. Un anónimo deja un payload que se ejecuta cuando un admin abre Analítica.

**Corrección (A-05, A-06, M-10):** renderizar como texto; si hace falta HTML, sanear con DOMPurify. Añadir CSP.

### A-07 · IDOR
- `GET /api/orders/[id]` no comprueba el propietario (`orders/[id]/route.ts:12-22`) y los IDs son secuenciales (`ORD-001`…): cualquier usuario enumera nombre, email y dirección de todos los clientes.
- `GET /api/wishlists/[id]` tampoco comprueba propietario ni `isPublic` (`wishlists/[id]/route.ts:10-31`), a diferencia de `DELETE` en el mismo archivo.

**Corrección:** filtrar por `userId` (como ya hace `orders/[id]/share`) y usar IDs no adivinables.

### A-08 · Tokens de compartición falsificables
`lib/share-crypto.ts` usa AES-256-CBC **sin MAC** y con una clave por defecto escrita en el código. Con la clave pública, cualquiera cifra `order:ORD-00N` o `report:internal` y `GET /api/documents/share` (sin autenticación) devuelve el pedido con dirección postal. Aun cambiando la clave, CBC sin autenticar permite alteración de bits, y los distintos errores (`Invalid share token format` frente a `Unsupported resource type '…'`, que refleja el texto descifrado) actúan como oráculo.

**Corrección:** tokens aleatorios guardados en base de datos con caducidad, o AES-GCM/HMAC con clave obligatoria por entorno.

### A-09 · Tarjetas regalo predecibles
El código se genera con un generador congruencial lineal sembrado con `createdAt.getTime()` truncado a 31 bits (`lib/gift-card.ts`, `gift-cards/route.ts:51-52`). Conocida la hora de creación al milisegundo, el código es determinista. Esa hora se filtra en los logs (línea 74-82, accesibles por C-08/C-05) y la tarjeta sembrada de 500 $ usa una fecha fija en `prisma/seed.ts`. El canje no tiene límite de intentos y solo impide que canjee el comprador, no que canjee alguien distinto del destinatario.

**Corrección:** códigos con `crypto.randomBytes`, vincular el canje al destinatario, limitar intentos.

### A-10 · Autorización en middleware sin verificar firma
`middleware.ts` solo decodifica el JWT en base64 y mira `role` (líneas 3-20); no comprueba la firma. Un token inventado con `role: ADMIN` y firma cualquiera pasa. La página `monitoring/internal-status` no hace ninguna comprobación propia, así que también cae ante el bypass de C-09. Las páginas `/admin/*` solo comprueban `localStorage` en el cliente; la protección real está en las APIs.

**Corrección:** verificar la sesión en el propio componente de servidor/ruta (defensa en profundidad), nunca solo en middleware.

### A-11 · Asistente de IA
- `mcpServerUrl` lo pone el usuario (`ai-assistant/route.ts:200-208`): el servidor hace `POST` a cualquier URL (SSRF) y **las descripciones de herramientas externas entran en el contexto del modelo**, que tiene acceso con credenciales internas a `get_compliance_report`. Un servidor MCP malicioso puede ordenar al modelo que llame a la herramienta restringida y devuelva el resultado.
- El prompt de sistema contiene un secreto (línea 22). Lo que está en el prompt debe considerarse extraíble.
- El filtro anti-inyección son cuatro expresiones regulares (`lib/prompt-injection-filter.ts`), evitables con cualquier reformulación o idioma.
- El endpoint no requiere autenticación.

**Corrección:** no aceptar servidores MCP arbitrarios, no poner secretos en prompts, aplicar la autorización de herramientas en el servidor según el usuario real y no según el modelo.

### A-12 · Gestión de secretos
- `.env.local` está en el repositorio con secretos; `.gitignore` y `.dockerignore` solo excluyen `.env`, así que **se versiona y se copia a la imagen** (`COPY . .`), igual que `flag.txt` y `supplier-registry.txt` (clave de API).
- `NEXT_PUBLIC_PAYMENT_SECRET` se incrusta en el JavaScript del navegador por el prefijo `NEXT_PUBLIC_` (`CheckoutClient.tsx:119`); es base64, no cifrado.
- Secretos en código: clave de stream RTMP (`lib/live-stream.ts:14`), clave AES (A-08), token de diagnóstico (B-01), credenciales SIEM (C-08), cabecera MCP (M-03).
- `public/notice.txt` se sirve públicamente.

**Corrección:** sacar los secretos del repositorio, rotarlos todos, ignorar `.env*`, usar variables de entorno o un gestor de secretos, y no usar `NEXT_PUBLIC_` para nada confidencial.

### A-13 · Emisión en directo
`POST /api/live/stream` usa `withAuth` y no `withAdminAuth` (`route.ts:56`): cualquier cliente cambia el vídeo de la página pública `/live`. El código detecta el caso (`hijacked`) pero solo lo registra. `GET` devuelve la configuración completa, incluida `streamKey`, a cualquier usuario (línea 30-33).

---

## Hallazgos medios

- **M-01 · Redirección abierta / XSS en login.** `window.location.href = redirect` con el parámetro `?redirect=` sin validar (`LoginForm.tsx:37`). Sirve para phishing y, con `javascript:…`, ejecuta script en el origen tras iniciar sesión. Aceptar solo rutas relativas que empiecen por `/` y no por `//`.
- **M-02 · `/internal` «protegida» por cabecera.** Basta enviar `X-Internal-Request: true` (`app/internal/page.tsx:17-20`); también se alcanza por el SSRF de A-03. `/internal/oauth/callback` se abre con cualquier sesión más la cookie que el login entrega si se envía `redirect`.
- **M-03 · MCP sin autenticación.** `/api/mcp` es público y la «sesión autorizada» es la cabecera constante `X-MCP-Session: quokka-internal-agent` definida en el código.
- **M-04 · Exportación de datos.** `password` está en la lista de campos exportables (`export/route.ts:7`) y pedir un campo inválido devuelve un bloque `debug` con versión de Node, entorno y un valor de la tabla de secretos (líneas 35-61, 77-91).
- **M-05 · Cupones.** Se comprueba `usedCount < maxUses`, se espera 150 ms y luego se incrementa sin transacción (`orders/route.ts:69-80`): peticiones simultáneas superan el máximo. Además el descuento lo calcula el cliente (ver C-11) y `/api/coupon/apply` no consume usos.
- **M-06 · Subida de imágenes.** Se confía en el `Content-Type` declarado por el cliente y se admite SVG, que luego se sirve como `image/svg+xml` desde el mismo origen con caché de un año: XSS almacenado si se abre directamente. Validar por contenido, excluir SVG o servir con `Content-Disposition: attachment` y CSP `sandbox`.
- **M-07 · Sesiones.** Sin revocación en servidor (logout solo borra la cookie), el rol del token no se revalida contra la base de datos, 7 días de vida (365 en soporte), el reseteo de contraseña no invalida sesiones. La cookie `siem_session` no lleva `secure` ni `sameSite`.
- **M-08 · Fuerza bruta y enumeración.** Ningún endpoint tiene límite de intentos. El login distingue «Invalid credentials» de «Invalid password» y el registro responde 409 si el email existe.
- **M-09 · `/api/flags` público.** Devuelve todas las filas de `flags`, incluido el valor secreto, sin autenticación. En un laboratorio es andamiaje; en cualquier otro contexto es una fuga directa.
- **M-10 · HTML remoto en soporte.** El contenido descargado por A-03 se inyecta con `dangerouslySetInnerHTML` (`SupportForm.tsx:103`): quien convenza a un usuario de enviar una URL concreta ejecuta script en su sesión.

## Hallazgos bajos

- **B-01** Token fijo `x-debug-auth` en `admin/diag/route.ts:6`; la ruta está bajo `/api/admin` pero no usa `withAdminAuth`. Un comentario HTML oculto en `app/admin/documents/page.tsx:5-6` menciona el paquete `react-toastfy` (nombre de typosquatting) «del registro interno»; **no aparece en `package.json` ni en el lockfile**, pero conviene revisar el origen de esa nota y eliminarla.
- **B-02** `next.config.ts` no define CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options` ni `Referrer-Policy`.
- **B-03** El `Dockerfile` no define `USER` (proceso como root), deja `python3/make/g++` en la imagen final y copia todo el contexto. `scripts/setup.sh` arranca Prisma Studio (acceso total a la base de datos, sin autenticación) en el puerto 5555.
- **B-04** `shareUrl` se compone con `Host` y `X-Forwarded-Proto` de la petición.
- **B-05** El campo `author` de una reseña lo decide el cliente, incluso autenticado: permite firmar como otro usuario.
- **B-06** Respuestas de error con rutas absolutas del servidor, mensajes del parser XML y el texto descifrado de tokens.

---

## Cadenas de ataque representativas

1. **Anónimo → administrador (una petición):** `POST /api/auth/signup` con `role: "ADMIN"` (C-02). Alternativas: firmar un JWT con `secret` (C-01) o resetear la contraseña del admin (C-03).
2. **Anónimo → todas las contraseñas:** enviar la cookie `siem_session=authenticated` a `/api/monitoring/logs` (C-08), o leer `../logs/app.log` por `/api/files` (C-05).
3. **Anónimo → base de datos completa:** `UNION SELECT` en `/api/products/search` (C-06); los hashes MD5 se rompen de inmediato (C-10).
4. **Anónimo → sesión de administrador sin tocar credenciales:** cabecera `X-Forwarded-For` con HTML en `/api/tracking` → XSS en Analítica (A-06) → el script llama a `/api/user/support-access`.
5. **Anónimo → ejecución de código:** vulnerabilidad del protocolo Flight en Next 15.2.2 (C-09).

## Plan de corrección priorizado

**Inmediato (bloquea cualquier despliegue)**
1. Actualizar `next`, `react`, `react-dom` y ejecutar `npm audit fix` (C-09).
2. `JWT_SECRET` obligatorio y aleatorio; usar `jsonwebtoken` (C-01).
3. Eliminar `role` del registro (C-02); token de reseteo aleatorio (C-03); restringir el acceso de soporte al propio usuario (C-04).
4. Autenticación y confinamiento de ruta en `/api/files` (C-05).
5. Parametrizar las cuatro consultas SQL en crudo (C-06, C-07, A-01, A-02).
6. Dejar de registrar contraseñas, proteger el SIEM, purgar `logs/app.log` (C-08).
7. Rotar **todos** los secretos y sacarlos del repositorio y de la imagen (A-12).

**Corto plazo**
8. Migrar a argon2id/bcrypt y quitar cuentas por defecto (C-10).
9. Calcular totales y cupones en servidor, en transacción (C-11, M-05).
10. Comprobaciones de propietario en pedidos y listas de deseos (A-07); `withAdminAuth` en `/api/live/stream` (A-13).
11. Quitar `innerHTML`/`dangerouslySetInnerHTML` con datos de usuario y añadir CSP (A-05, A-06, M-10, B-02).
12. Cerrar SSRF y XXE (A-03, A-04, A-11); rediseñar tokens de compartición y tarjetas regalo (A-08, A-09).
13. Autorización en cada página/ruta de servidor, no en middleware (A-10, M-02, M-03).

**Medio plazo**
14. Límite de intentos y mensajes uniformes en autenticación (M-08); revocación de sesiones (M-07).
15. Endurecer la subida de archivos (M-06) y el contenedor (B-03).
16. Añadir pruebas de seguridad automatizadas (SAST y `npm audit` en CI) para que no reaparezcan.

## Limitaciones

- Revisión estática: no se confirmó ningún hallazgo contra una instancia en ejecución. Los de lógica de código (C-01 a C-08, C-11, SQLi, IDOR) se leen directamente en las líneas citadas; los de dependencias (C-09) se basan en la versión del lockfile y en `npm audit`.
- Los componentes de cliente se revisaron de forma dirigida (sumideros de HTML, redirecciones, almacenamiento local, variables `NEXT_PUBLIC_`), no línea a línea.
- No se evaluó la infraestructura de despliegue (proxy, TLS, red), que no está en el repositorio.
