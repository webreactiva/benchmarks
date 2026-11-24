# Auditoría de seguridad — Quokka Bazaar 2.17.0

**Fecha:** 24 de noviembre de 2026  
**Alcance:** código fuente, 52 endpoints API, componentes cliente, esquema Prisma, configuración Next.js, Docker, scripts, lockfile y empaquetado npm.  
**Método:** revisión estática manual, análisis de flujos entrada → validación → operación sensible, búsqueda de secretos con valores omitidos, `npm audit` y `npm pack --dry-run`.  
**Contexto de severidad:** se evalúa como si se desplegara en producción. El repositorio contiene material propio de un laboratorio vulnerable; esa finalidad no reduce el riesgo si se publica. No se asignan puntuaciones CVSS sin validación dinámica.

> **Conclusión:** el proyecto **no es apto para exposición a Internet ni para usar datos reales** en su estado actual. Hay múltiples vías independientes para obtener privilegios administrativos, tomar cuentas, leer archivos y datos, alterar operaciones comerciales y acceder a contraseñas registradas. Debe aislarse el servicio hasta corregir los hallazgos críticos.

## 1. Resumen ejecutivo

Se documentan **36 grupos de hallazgos**:

| Severidad | Grupos |
|---|---:|
| Crítica | 10 |
| Alta | 13 |
| Media | 12 |
| Baja | 1 |
| **Total** | **36** |

Las cadenas más urgentes son:

1. **Administración sin confianza previa:** clave JWT de respaldo conocida (C-01), registro con rol administrador (C-02) y credenciales administrativas sembradas por defecto (C-08).
2. **Toma de cuentas:** token de recuperación calculable a partir del correo y la hora devuelta por la propia API (C-03), o creación de un token de soporte para cualquier cuenta (C-04).
3. **Compromiso de datos:** SQL no parametrizado en cuatro rutas (C-05), lectura/listado arbitrario de archivos sin autenticación (C-06), secretos y banderas expuestos (H-07).
4. **Compromiso de credenciales:** cada intento de login registra la contraseña en texto claro y el visor admite una cookie fija falsificable (C-07).
5. **Riesgo de plataforma:** Next.js 15.2.2 está dentro de rangos con avisos críticos, incluidos RCE y bypass de middleware (C-09).
6. **Fraude comercial:** el total del pedido lo decide el cliente y no hay validación de pago en el servidor (C-10); las tarjetas regalo también tienen defectos de emisión y generación (H-08).

### Prioridad inmediata

- Retirar el servicio de cualquier red no confiable y preservar evidencias.
- Sustituir claves y secretos, invalidar todas las sesiones/tokens y forzar restablecimiento seguro de contraseñas. Las contraseñas intentadas pueden estar en logs; considerar también reutilización en otros servicios.
- Actualizar Next.js, corregir C-01 a C-08 y C-10, y desactivar temporalmente las rutas de archivos, flags, MCP/AI, soporte con URL, importación XML y subida SVG hasta aplicar controles.
- Revisar logs, base de datos, pedidos, tarjetas, tokens y accesos administrativos por indicios de uso indebido.

## 2. Metodología y evidencias

### Trabajo realizado

- Inventario y revisión de los **52 archivos `route.ts`** y sus controles de autenticación/autorización.
- Revisión de sesiones JWT, recuperación de contraseña, soporte, pedidos, cupones, tarjetas regalo, carrito, listas, ficheros, subidas, XML, SSRF, MCP/LLM, streaming y monitorización.
- Revisión de `Dockerfile`, Compose, exclusión de archivos, seed, configuración Next.js y almacenamiento en navegador.
- Búsqueda de patrones de secretos; las 43 coincidencias potenciales se trataron como material sensible y **no se copiaron sus valores** a este informe.
- Auditoría completa y de producción del lockfile. `npm audit` devolvió código 1 por existir avisos, no por un fallo de ejecución.
- Simulación de paquete npm sin publicarlo ni crear el tarball.

### Archivos de evidencia

| Archivo | Contenido |
|---|---|
| `npm-audit.json` | Resultado completo de `npm audit --package-lock-only --json`. |
| `npm-audit-production.json` | Resultado con `--omit=dev`. |
| `npm-pack-dry-run.json` | Lista de archivos que entrarían en un paquete npm; no contiene el contenido de esos archivos. |

### Limitaciones

- No existían `node_modules`, pruebas automatizadas ni una instancia aislada preparada. No se instalaron dependencias ni se ejecutó la aplicación.
- No se lanzaron exploits, escrituras SQL, peticiones a Mistral/MCP externos ni pruebas contra datos reales. Los hallazgos de código se basan en rutas de ejecución verificables; los comportamientos dependientes de LLM, proxy o driver se identifican como condicionados.
- No hay directorio `.git`; no se pudo revisar historial, secretos previamente versionados, ramas ni procedencia de commits.
- La revisión de dependencias es la del registro npm en la fecha indicada. Un aviso de paquete no implica necesariamente que todas sus funciones vulnerables sean alcanzables.
- La configuración de un proxy TLS/WAF externo, si existiera, no está incluida. No se presupone que compense los fallos de aplicación.

## 3. Hallazgos críticos

### C-01 — Firma JWT con secreto de respaldo conocido

**CWE:** CWE-798, CWE-347 · **Referencias:** `lib/server-auth.ts:12`, `lib/server-auth.ts:22-53`, `lib/server-auth.ts:100-119`; `docker-compose.yml:6-11`.

- La aplicación usa un secreto literal de respaldo si falta `JWT_SECRET`. `.env.local` no define esa variable y la configuración Docker aportada tampoco; por tanto, salvo una variable externa no incluida, se usa el valor conocido.
- Con ese secreto se puede firmar una cookie con `role: "ADMIN"` e identificadores arbitrarios. La mayoría de `withAdminAuth` confía en el rol del token sin releer el usuario. Además, `exp` es opcional durante la validación, permitiendo tokens sin caducidad.
- **Impacto:** bypass general de autenticación y autorización, incluido acceso a operaciones administrativas.
- **Corrección:** eliminar todo respaldo; fallar al arrancar si falta un secreto aleatorio de alta entropía gestionado por un almacén de secretos. Usar una biblioteca JWT mantenida, lista explícita de algoritmos, `exp` obligatorio, `iss`/`aud`/`nbf`, validación estricta del payload y rotación con identificador de clave. Revalidar en base de datos el estado/rol cuando la operación lo requiera.

### C-02 — Registro público permite asignarse el rol ADMIN

**CWE:** CWE-915, CWE-862 · **Referencias:** `lib/validation/schemas/auth.ts:3-9`; `app/api/auth/signup/route.ts:48-64`.

- El esquema acepta `role` desde el cuerpo y la ruta lo copia al objeto persistido mediante un cast, sin permitir únicamente el rol de cliente.
- **Explotación:** una petición de registro no autenticada con `role` igual al valor del enum administrativo crea una cuenta privilegiada y devuelve una sesión válida.
- **Corrección:** eliminar `role` del esquema de entrada y fijar siempre `CUSTOMER` en servidor. Los cambios de rol deben ser una operación administrativa separada, autorizada y auditada. Añadir una prueba que rechace campos de privilegio aunque se envíen deliberadamente.

### C-03 — Recuperación de contraseña con token determinista y hora revelada

**CWE:** CWE-330, CWE-640 · **Referencias:** `app/api/auth/forgot-password/route.ts:13-24`, `app/api/auth/forgot-password/route.ts:39-43`; `app/api/auth/reset-password/route.ts:13-55`.

- El token es MD5 de `email + timestamp`, donde el timestamp tiene resolución de un segundo. La respuesta contiene `requestedAt`, generado a partir del mismo instante, incluso cuando la respuesta aparenta ser genérica.
- Un atacante puede solicitar recuperación para una cuenta objetivo, derivar el token y usarlo en el endpoint de reseteo sin acceder al correo.
- **Impacto:** toma remota de cualquier cuenta, incluida una administrativa.
- **Corrección:** usar al menos 32 bytes de `crypto.randomBytes`, almacenar únicamente un hash del token, un solo uso y caducidad corta. No devolver datos temporales útiles para derivarlo. Invalidar sesiones al cambiar la contraseña y aplicar rate limiting. Migrar también el almacenamiento de contraseñas (H-12).

### C-04 — Un usuario puede crear acceso de soporte para otra cuenta

**CWE:** CWE-639, CWE-862, CWE-613 · **Referencias:** `app/api/user/support-access/route.ts:51-91`; `lib/validation/schemas/user.ts:15-19`; `app/api/auth/support-login/route.ts:15-59`.

- `POST /api/user/support-access` acepta un correo arbitrario y asigna el nuevo token al usuario encontrado, no al usuario autenticado. El token se devuelve al solicitante.
- `/api/auth/support-login` convierte ese token en una sesión con el ID, correo y rol de la víctima. No comprueba `supportToken.revoked`, por lo que revocar no impide el inicio de sesión. La caducidad del JWT de soporte es de un año y el token aparece en la query string.
- **Impacto:** toma de cuentas de clientes o administradores por cualquier usuario autenticado; persistencia tras revocación y exposición adicional por historial, registros o referrers.
- **Corrección:** retirar `email` de la entrada o exigir autorización explícita y reautenticación del propietario. Comprobar `revoked`, caducidad y audiencia en cada uso; usar tokens de corta duración y un solo uso, preferiblemente intercambiados por POST. Invalidar sesiones derivadas al revocar y registrar eventos sin incluir el token.

### C-05 — Inyección SQL en cuatro endpoints

**CWE:** CWE-89 · **OWASP:** A03:2021.

| Ruta | Entrada y sumidero | Acceso |
|---|---|---|
| `app/api/products/search/route.ts:35-40,85-103` | `q` se interpola en `LIKE` y llega a `$queryRawUnsafe`. | Público |
| `app/api/tracking/route.ts:58-60,96-103` | `x-forwarded-for` y `sessionId` se interpolan en un `INSERT`; solo otros campos escapan comillas. | Público |
| `app/api/orders/search/route.ts:36-40,81-103` | `status` es una cadena libre y se concatena en SQL ejecutado con `$queryRawUnsafe`. | Usuario autenticado |
| `app/api/admin/reviews/route.ts:102-143` | `author` se concatena en SQL; `better-sqlite3.exec()` permite ejecutar el texto y luego se prepara otra consulta igualmente insegura. | Administrador o autor almacenado seleccionado por un administrador |

- La validación Zod comprueba tipos, pero no hace segura una consulta concatenada. El filtrado posterior de cadenas con formato de bandera tampoco es una defensa SQL.
- La ruta administrativa también admite **SQLi de segundo orden**: un anónimo puede almacenar un `author` mediante reseñas (`app/api/products/[id]/reviews/route.ts:41-70`); cuando un administrador selecciona ese autor en `app/admin/reviews/ReviewsClient.tsx:257-269`, el valor llega a `db.exec`. Los `catch` no deshacen sentencias ya ejecutadas.
- **Impacto:** lectura no autorizada mediante búsqueda/UNION, evasión del filtro `userId`, modificación o destrucción de datos cuando el driver admita sentencias adicionales, y denegación de servicio. La ruta administrativa usa explícitamente `exec`, por lo que el riesgo de sentencias múltiples es especialmente claro.
- **Corrección:** usar métodos Prisma o `$queryRaw` con parámetros enlazados; nunca `$queryRawUnsafe` con entrada. Para `better-sqlite3`, una única sentencia preparada con parámetros. Validar enums como defensa adicional y añadir pruebas con comillas, comentarios SQL y UNION. Revisar la base por alteraciones.

### C-06 — Lectura y listado arbitrario de archivos sin autenticación

**CWE:** CWE-22, CWE-862 · **Referencias:** `app/api/files/route.ts:8-67`; `lib/validation/schemas/files.ts:3-7`.

- `file` y `path` se concatenan con la carpeta `documents` mediante `join`, sin rechazar `..`, resolver la ruta canónica ni comprobar que permanezca dentro de la base.
- La ruta no usa `withAuth`/`withAdminAuth`; la comprobación que existe en `DocumentsClient` es solo de interfaz y no protege la API. También permite listar directorios.
- **Impacto:** lectura de configuración, `.env.local`, código, base de datos, archivos del sistema accesibles al proceso y documentos privados, según permisos y número de niveles atravesados.
- **Corrección:** no aceptar rutas arbitrarias. Usar identificadores de documento mapeados en base de datos, con autorización por objeto. Si fuera imprescindible aceptar rutas, aplicar `realpath` a base y destino, comprobar prefijo por componente, impedir enlaces simbólicos y limitar extensiones. Devolver errores genéricos y añadir pruebas de traversal codificado.

### C-07 — Contraseñas en texto claro en logs y autenticación SIEM falsificable

**CWE:** CWE-532, CWE-798, CWE-287 · **Referencias:** `app/api/auth/login/route.ts:16-25`; `lib/logger.ts:3-14`; `app/api/monitoring/auth/route.ts:5-20`; `app/api/monitoring/logs/route.ts:7-23,40-84`.

- Cada intento de login registra correo y **contraseña en claro**, tanto en propiedades como en el mensaje.
- El visor acepta la cookie `siem_session` si su valor coincide con una cadena fija, sin firma ni verificación de servidor. Un cliente puede proporcionar esa cookie directamente. Además hay credenciales SIEM estáticas en el código.
- **Impacto:** cualquier visitante capaz de solicitar la API de logs con esa cookie puede obtener contraseñas actuales, fallidas y posiblemente reutilizadas, además de datos operativos.
- **Corrección:** eliminar inmediatamente contraseñas y tokens de todos los logs; depurar los logs existentes siguiendo el procedimiento de incidente y rotar credenciales. Sustituir la cookie fija por sesiones aleatorias del lado servidor, expiración, revocación, `Secure`, `HttpOnly` y `SameSite`. Restringir SIEM por identidad y red, añadir MFA y controlar acceso/rotación del archivo.

### C-08 — Cuenta administrativa y credenciales predecibles instaladas por el seed

**CWE:** CWE-798, CWE-1392 · **Referencias:** `prisma/seed.ts:655-716`; `docker-entrypoint.sh:4-10`; `app/login/LoginForm.tsx:56-64`.

- El seed crea o restablece usuarios conocidos, incluida una cuenta administrativa con una contraseña literal trivial. En un volumen nuevo, el entrypoint ejecuta automáticamente ese seed antes de iniciar la aplicación.
- La pantalla pública publica además credenciales de un usuario de demostración. Los hashes MD5 públicos del seed/noticias facilitan validar o recuperar otras contraseñas.
- **Impacto:** compromiso inmediato de una instalación nueva o reseedada, incluso si se corrigieran otras vías de elevación.
- **Corrección:** no ejecutar seed de demostración en producción ni restablecer contraseñas en `upsert`. Exigir un proceso único de aprovisionamiento administrativo con secreto aleatorio/MFA y borrar cuentas de ejemplo. Rotar las credenciales de cualquier entorno donde se haya ejecutado.

### C-09 — Next.js 15.2.2 con avisos críticos aplicables al framework

**CWE:** múltiples · **Referencias:** `package.json:33`, `package-lock.json`; `npm-audit.json`.

- La versión exacta está fijada en 15.2.2. Entre los avisos agregados por npm se incluyen RCE en React Flight (`GHSA-9qr9-h5gf-34mp`) y bypass de middleware (`GHSA-f82v-jwr5-mffw`), cuyos rangos incluyen esta versión.
- Existen otros avisos de RCE, DoS, SSRF, XSS, caché y exposición condicionados a sistema operativo, Server Actions, Image Optimization, Edge o configuración concreta. No todos deben considerarse automáticamente explotables en esta aplicación, pero el proyecto usa App Router/RSC, middleware e imágenes, por lo que no es seguro diferir la actualización.
- **Corrección:** actualizar como mínimo a **Next.js 15.5.29**, versión de corrección no mayor indicada por el propio audit, y validar compatibilidad con React 19.2.0. Revisar los avisos oficiales y repetir build/pruebas/audit. No usar `npm audit fix --force` como sustituto de una migración controlada.

### C-10 — Total del pedido y pago controlados por el cliente

**CWE:** CWE-840, CWE-345 · **Referencias:** `app/api/orders/route.ts:35-40,64-88,125-132`; `app/checkout/CheckoutClient.tsx:119-141`.

- El servidor acepta cualquier `total` numérico positivo y lo persiste. Nunca recalcula `sum(price * quantity)` desde el carrito ni aplica de forma autoritativa el descuento.
- El navegador envía una cabecera de pago derivada de una variable `NEXT_PUBLIC_*`, por definición expuesta al cliente, pero la ruta de pedidos ni siquiera la lee. Tampoco existe verificación de una transacción de pago.
- **Impacto:** creación de pedidos por importes arbitrariamente bajos y sin prueba de pago. El impacto financiero es directo si un pedido `PENDING` pasa a preparación sin un control externo no incluido.
- **Corrección:** ignorar el total del cliente; calcularlo en servidor con precios actuales y aritmética monetaria entera/decimal. Revalidar cupón, stock, importe y moneda en una transacción. Confirmar pagos mediante webhooks autenticados e idempotentes del proveedor antes de cumplir el pedido. Eliminar el supuesto secreto público.

## 4. Hallazgos de severidad alta

### H-01 — IDOR/BOLA en consulta de pedidos

**CWE:** CWE-639 · **Referencias:** `app/api/orders/[id]/route.ts:8-64`; generación secuencial en `app/api/orders/route.ts:112-132`.

- La ruta exige una sesión, pero busca solo por `id`; nunca compara `order.userId` con `user.id`. Devuelve correo y dirección completa.
- Los IDs `ORD-###` son secuenciales, facilitando enumeración. La comprobación de propietario sí existe al crear un enlace de compartición, pero no al leer directamente el pedido.
- **Corrección:** consultar por `{ id, userId: user.id }` para clientes, con una ruta administrativa separada y auditada. Probar acceso cruzado entre dos cuentas.

### H-02 — SSRF pública con respuesta en soporte

**CWE:** CWE-918 · **Referencias:** `app/api/support/route.ts:6-37`; `lib/validation/schemas/support.ts:3-8`.

- `screenshotUrl` es cualquier cadena y se pasa a `fetch` sin esquema/host permitidos, validación de IP, límite, timeout ni bloqueo de redirecciones. El cuerpo recuperado se devuelve en JSON.
- Se añade una cabecera que la aplicación considera indicadora de petición interna (véase M-03).
- **Impacto:** lectura de HTTP(S) interno, localhost o metadatos cloud cuando sean accesibles, además de consumo de memoria/conexiones. No se afirma soporte `file://` en el `fetch` de Node.
- **Corrección:** eliminar la recuperación arbitraria o usar un servicio aislado de ingesta. Permitir solo HTTPS y destinos explícitos; resolver y bloquear IP privadas, loopback, link-local y reservadas en cada redirección; limitar bytes/tiempo y no reflejar el contenido.

### H-03 — XSS almacenado en analítica administrativa

**CWE:** CWE-79 · **Referencias:** entrada en `app/api/tracking/route.ts:58-60,96-103`; salida en `app/api/admin/analytics/route.ts:23-57`; render en `app/admin/analytics/AnalyticsClient.tsx:354-367`.

- Un cliente público controla `x-forwarded-for`, que se guarda como `ip`. El panel inserta ese valor con `dangerouslySetInnerHTML` sin sanitización.
- **Impacto:** ejecución JavaScript al visitar el panel un administrador, acciones con su sesión y robo de datos accesibles al DOM/localStorage. No depende de que el atacante tenga una cuenta.
- **Corrección:** eliminar `dangerouslySetInnerHTML` y renderizar texto. Añadir CSP restrictiva como defensa adicional y normalizar IP solo tras una configuración de proxy confiable; no confiar directamente en cabeceras de cliente.

### H-04 — Cualquier usuario puede alterar el streaming y leer su clave

**CWE:** CWE-862, CWE-200 · **Referencias:** `app/api/live/stream/route.ts:30-33,56-99`; `lib/live-stream.ts:10-15`.

- `POST /api/live/stream` usa `withAuth`, no `withAdminAuth`; el cambio solicitado por un no administrador se persiste deliberadamente y solo se marca/registra como `hijacked`.
- `GET` devuelve el objeto completo, incluidos `rtmpUrl` y `streamKey`, a cualquier usuario autenticado. La clave también está escrita en el código.
- **Impacto:** modificación del contenido público y posible uso indebido del canal de ingesta.
- **Corrección:** exigir autorización administrativa para escribir, separar DTO público de credenciales, no devolver secretos y rotar la clave. Retirar la lógica que permite deliberadamente el secuestro.

### H-05 — XXE y expansión de entidades en importación XML

**CWE:** CWE-611, CWE-776 · **Referencias:** `app/api/admin/suppliers/import-order/route.ts:12-24,41-47,65-90`.

- Se habilitan `noent` y `dtdload` al parsear XML completo del cliente; no se deshabilita DTD ni se limita tamaño/expansión. Los valores de entidades pueden terminar en campos persistidos y reflejados en la respuesta.
- Aunque la ruta exige administrador, C-01/C-02/C-08 hacen ese requisito insuficiente como mitigación.
- **Impacto:** lectura local, SSRF según capacidades/red del parser, exfiltración en campos y denegación de servicio. Los mensajes de error también revelan detalles del parser/rutas.
- **Corrección:** prohibir DOCTYPE, entidades externas y DTD; usar un parser configurado sin sustitución ni red, límites estrictos y esquema validado. Considerar JSON con Zod. No devolver mensajes internos.

### H-06 — Tokens de compartición falsificables, sin autenticidad ni ciclo de vida

**CWE:** CWE-798, CWE-353, CWE-613 · **Referencias:** `lib/share-crypto.ts:6-31`; `app/api/documents/share/route.ts:7-110`; `app/api/orders/[id]/share/route.ts:19-25`.

- AES-CBC usa una clave hexadecimal de respaldo publicada en el código. `.env.local` no define `SHARE_ENCRYPTION_KEY` y Docker tampoco la aporta, salvo configuración externa.
- No hay MAC/AEAD, expiración, audiencia, revocación ni registro del token. Quien conozca la clave puede cifrar identificadores elegidos, incluidos pedidos y el informe interno soportado por la ruta.
- **Impacto:** acceso anónimo a detalles y direcciones de pedidos; enlaces legítimos permanecen utilizables indefinidamente.
- **Corrección:** clave aleatoria obligatoria, AES-GCM o token firmado con `exp`, `jti`, alcance y revocación. Autorizar el recurso cuando no sea deliberadamente público y minimizar los datos compartidos.

### H-07 — Banderas, hashes y artefactos internos expuestos públicamente

**CWE:** CWE-200, CWE-538 · **Referencias:** `app/api/flags/route.ts:5-13`; `app/api/flags/[slug]/route.ts:5-19`; `app/news/page.tsx:4-17,95-135`; `public/notice.txt:1`; `flag.txt`, `supplier-registry.txt`, `prisma/seed.ts`.

- Las APIs de flags no autentican y devuelven el modelo completo, incluido el campo `flag`. La página pública de noticias incluye correos y hashes de contraseña. Hay otros códigos en un archivo público, seed, registro de proveedores y configuración.
- **Impacto:** divulgación de secretos/validadores y ayuda directa para cracking, enumeración o superación de controles. En un laboratorio pueden ser intencionados; deben estar segregados de cualquier build real.
- **Corrección:** eliminar estos datos del paquete de producción y de la base pública. Usar valores ficticios claramente separados, DTO con campos mínimos y autorización cuando haya información real. Rotar cualquier valor reutilizado.

### H-08 — Emisión sin cobro y códigos predecibles de tarjetas regalo

**CWE:** CWE-330, CWE-840 · **Referencias:** `lib/gift-card.ts:5-24`; `app/api/gift-cards/route.ts:38-63`; `app/api/gift-cards/redeem/route.ts:24-72`; ejemplo temporal en `prisma/seed.ts:1205-1225`.

- El código se genera con un LCG de 31 bits sembrado con `Date.now()`. La hora de creación se conoce o acota y el seed incluso fija una fecha conocida. No se aplica rate limiting a canjeos.
- Cualquier usuario autenticado puede crear tarjetas por importes permitidos sin pago ni débito. Aunque no puede auto-canjejarlas, dos cuentas pueden eludir esa comprobación; el canje incrementa `creditBalance`.
- El saldo no se utiliza actualmente en el checkout incluido, lo que limita el impacto demostrado en este árbol, pero sí se altera un activo de cuenta y pueden canjearse tarjetas ajenas/presembradas.
- **Corrección:** emitir solo tras pago confirmado en servidor, generar al menos 128 bits con CSPRNG, almacenar hashes de códigos y limitar intentos por cuenta/IP. Aplicar transacciones e idempotencia y conciliar saldos existentes.

### H-09 — Secretos incluidos en contexto Docker y paquete npm

**CWE:** CWE-538, CWE-200 · **Referencias:** `.gitignore:37-40`; `.dockerignore:4-5`; `Dockerfile:7-10`; `package.json:2-4`; evidencia `npm-pack-dry-run.json`.

- Solo `.env` está excluido; `.env.local` no. `COPY . .` puede incorporarlo, junto con flags y seed, a la imagen final. El archivo local tiene modo `0644`, legible por otros usuarios del host según el entorno.
- El paquete tiene `private: false`. La simulación real de `npm pack` confirmó que incluiría `.env.local`, `flag.txt`, `supplier-registry.txt` y `prisma/seed.ts`. No se publicó nada.
- **Impacto:** extracción de secretos por cualquier receptor de la imagen o publicación accidental del paquete. No se afirma que el archivo esté versionado; no había historial Git disponible.
- **Corrección:** marcar `"private": true` si no debe publicarse, definir una allowlist `files`, excluir `.env*`, secretos, flags y datos de laboratorio en Git/Docker/npm. Usar BuildKit secrets/variables de runtime, imagen multietapa, permisos `0600` y rotar todo valor que haya podido distribuirse.

### H-10 — MCP protegido por una constante pública y asistente susceptible a prompt injection

**CWE:** CWE-798, CWE-200 · **OWASP LLM:** LLM01/LLM02 · **Referencias:** `lib/mcp-constants.ts:1-2`; `app/api/mcp/route.ts:142-160,168-202`; `app/api/ai-assistant/route.ts:8-33,167-182,200-219,253-319`; `lib/prompt-injection-filter.ts:1-10`.

- El informe de cumplimiento solo exige una cabecera con una constante escrita en el código. `tools/list` es público y revela la herramienta restringida; no hay identidad real del agente.
- El prompt del sistema contiene un código interno y ordena incluir códigos de herramientas. El filtro son cuatro expresiones regulares sobre el mensaje inicial; no protege salidas, descripciones de MCP externas ni instrucciones indirectas.
- El modelo puede decidir llamar a herramientas internas con la cabecera privilegiada y devolver su resultado. La extracción concreta depende del LLM, pero **la llamada directa al MCP con la constante no depende del modelo**.
- **Corrección:** autenticación real por servicio, autorización server-side por herramienta y usuario, eliminar secretos del prompt, no tratar instrucciones del modelo como control de acceso. Aislar MCP externos, validar/esquematizar herramientas, aplicar políticas de salida y nunca incluir códigos internos en respuestas.

### H-11 — Subida de SVG activo servido desde el origen de la aplicación

**CWE:** CWE-79, CWE-434 · **Referencias:** `app/api/admin/products/[id]/image/route.ts:9-17,47-85`; `app/api/uploads/[...path]/route.ts:6-49`; `app/products/[id]/ProductDetailClient.tsx:170-182`.

- Se confía en `file.type` y se admite SVG sin analizar contenido ni sanitizarlo. Después se sirve como `image/svg+xml`, sin `Content-Disposition: attachment` ni CSP de recurso, y con caché pública de un año.
- La página pública no se limita a un `<img>`: para estas rutas utiliza explícitamente un **`<object>` sin sandbox**, lo que proporciona un contexto de documento activo. También existe riesgo al abrir directamente la URL. La escritura requiere administrador, pero puede afectar a visitantes y otros administradores; las vías críticas eliminan esa barrera.
- **Corrección:** no aceptar SVG o convertirlo a un formato rasterizado seguro en un worker aislado. Eliminar el `<object>`, verificar magic bytes, reescribir nombres con UUID y servir subidas desde un dominio separado sin cookies, con `nosniff` y política de descarga. Mantener límite de cuerpo antes de `formData()`.

### H-12 — Contraseñas con MD5 sin sal y política de contraseña insuficiente

**CWE:** CWE-916, CWE-521 · **Referencias:** `lib/server-auth.ts:14-16`; `app/api/auth/signup/route.ts:46`; `app/api/auth/reset-password/route.ts:46`; `lib/validation/schemas/auth.ts:3-9,21-24`; `prisma/seed.ts:576-578`.

- MD5 es rápido, no está adaptado a contraseñas y no usa sal. Los hashes iguales son idénticos y la exposición por SQLi/archivos/noticias permite cracking masivo.
- El registro acepta incluso una cadena vacía en servidor; la comprobación de seis caracteres existe solo en el cliente. El reseteo permite seis caracteres, también insuficiente como política única.
- **Corrección:** migrar a Argon2id con parámetros medidos o bcrypt/scrypt adecuadamente configurados, con sal única y rehash al login. Aplicar longitud mínima razonable, contraseñas comprometidas, MFA para privilegiados y rate limiting; no enumerar cuentas mediante respuestas diferenciadas.

### H-13 — XSS persistente anónimo en reseñas con reactivación explícita de scripts

**CWE:** CWE-79 · **Referencias:** `app/api/products/[id]/reviews/route.ts:41-73`; `lib/validation/schemas/products.ts:7-10`; `app/products/[id]/ProductDetailClient.tsx:27-33,51-67,402-420`.

- Cualquier visitante puede guardar una reseña sin autenticación; `content` solo debe ser una cadena no vacía y no se sanitiza. Al mostrarla, el componente asigna el valor directamente a `innerHTML`.
- Después busca etiquetas `script`, las clona y reemplaza expresamente para que se ejecuten, superando incluso el comportamiento habitual por el que scripts insertados con `innerHTML` no se ejecutan.
- **Impacto:** JavaScript persistente en el origen para cualquier visitante del producto, incluidos administradores; permite llamar APIs con la cookie de la víctima y leer localStorage, incluida la clave Mistral de M-10.
- **Corrección:** eliminar toda asignación a `innerHTML` y la recreación de scripts; renderizar `review.content` como texto React. Si se admitiera formato, usar Markdown sin HTML crudo o sanitización estricta, CSP y pruebas con eventos HTML/scripts. Revisar y eliminar reseñas maliciosas existentes.

## 5. Hallazgos de severidad media

### M-01 — Listas privadas y correo del propietario accesibles por ID

**CWE:** CWE-639 · **Referencias:** `app/api/wishlists/[id]/route.ts:6-81`.

- El `user` autenticado no se utiliza en el GET. No se comprueba propiedad ni `isPublic`; se devuelven productos, fechas y correo del propietario. Las operaciones de borrado/agregado sí comprueban propiedad.
- **Corrección:** exigir `userId` o `isPublic: true` según el caso, no devolver correo en una lista pública y probar accesos cruzados.

### M-03 — Controles de páginas internas basados en JWT sin verificar o cabecera falsificable

**CWE:** CWE-347, CWE-290 · **Referencias:** `middleware.ts:3-39`; `app/internal/page.tsx:15-21`.

- El middleware decodifica payload y comprueba rol/expiración, pero **no verifica la firma**. Su matcher solo cubre `/monitoring/internal-status`; no es una protección general de `/admin` ni de APIs.
- `/internal` confía únicamente en `x-internal-request: true`, que un cliente externo puede enviar directamente; no requiere SSRF.
- El contenido observado es principalmente diagnóstico, lo que limita el impacto individual, pero demuestra una frontera de acceso insegura.
- **Corrección:** usar la misma verificación robusta de servidor que las APIs, autorizar cada página/endpoint sensible y no aceptar una cabecera de cliente como prueba de origen. Hacer la restricción en red/identidad real.

### M-04 — HTML no sanitizado en la respuesta del formulario de soporte

**CWE:** CWE-79 · **Referencias:** `app/api/support/route.ts:14-37`; `app/support/SupportForm.tsx:95-106`.

- El contenido de la URL se refleja y se renderiza mediante `dangerouslySetInnerHTML`. Es un flujo reflejado en el navegador del remitente, no un XSS almacenado para administradores; requiere que la víctima envíe una URL controlada o un flujo equivalente.
- **Corrección:** mostrar texto con escape normal de React o sanitizar con una política estricta si HTML es imprescindible. Resolver H-02 y añadir CSP.

### M-05 — Ausencia sistémica de rate limiting, límites tempranos y timeouts

**CWE:** CWE-770, CWE-400 · **Referencias:** `lib/validation/index.ts:33-87`; login/reset/canjeo; `app/api/admin/suppliers/import-order/route.ts:12`; `app/api/support/route.ts:16-21`; `app/api/ai-assistant/route.ts:69-82,149-156`; `app/api/monitoring/logs/route.ts:60-82`.

- `request.text()`/`formData()` consumen cuerpos sin un límite de aplicación. El límite de imagen de 5 MB se comprueba después de parsear el formulario. Las llamadas salientes no tienen timeout ni límite de respuesta.
- No hay limitador en login, recuperación, soporte, tracking, canje o AI. Tracking permite escrituras públicas; logs se leen enteros y síncronos; el bucle AI limita iteraciones externas, pero una respuesta con múltiples tool calls puede ejecutar varias dentro de una misma ronda.
- **Impacto:** fuerza bruta, enumeración/canjeo, crecimiento de disco, agotamiento de memoria, conexiones, CPU y coste externo.
- **Corrección:** límites en proxy y aplicación, streaming con conteo, `AbortSignal.timeout`, tamaño máximo de respuesta, colas/concurrencia acotadas, rate limiting distribuido por IP/cuenta/acción, paginación y rotación de logs.

### M-06 — Cupones y operaciones comerciales sin transacciones completas

**CWE:** CWE-367, CWE-662 · **Referencias:** `app/api/orders/route.ts:64-88,90-190`; `app/api/coupon/apply/route.ts:14-40`; `app/api/gift-cards/redeem/route.ts:52-72`.

- El cupón se comprueba y luego se incrementa tras una espera, sin condición atómica sobre `usedCount < maxUses`; peticiones concurrentes pueden superar el máximo. Se puede consumir antes de validar la dirección o completar el pedido.
- Pedido, líneas, factura, limpieza del carrito y cupón no forman una transacción. En tarjetas, el cambio a `REDEEMED` está condicionado atómicamente, pero el incremento del saldo es otra operación; un fallo deja estados parciales.
- **Corrección:** transacciones de base de datos, actualizaciones condicionadas, claves de idempotencia, restricciones únicas y compensación/reintentos. Recalcular importes en servidor (C-10).

### M-07 — Sesiones no revocadas tras reset/logout y reseteo no atómico

**CWE:** CWE-613, CWE-367 · **Referencias:** `app/api/auth/reset-password/route.ts:13-55`; `app/api/auth/logout/route.ts:4-7`; `lib/server-auth.ts:31-69`.

- Logout solo borra la cookie del navegador; un JWT copiado sigue válido. Cambiar la contraseña tampoco revoca sesiones existentes ni otros tokens.
- El reset comprueba `used` y actualiza contraseña/token en operaciones separadas; solicitudes paralelas pueden competir antes de marcarse como usado.
- **Corrección:** almacenar sesiones o versiones de token revocables, incrementar `sessionVersion` al cambiar credenciales/rol, revocar en logout y usar una transacción con consumo atómico del token de reset.

### M-08 — Exportación y diagnóstico revelan hashes, errores y datos internos

**CWE:** CWE-200, CWE-209, CWE-489 · **Referencias:** `app/api/user/export/route.ts:7,35-60,77-93,127-140`; `app/api/admin/diag/route.ts:5-25`; `app/admin/documents/page.tsx:5-12`.

- `password` figura entre campos exportables. Un campo inválido o error devuelve diagnóstico de entorno, versión, posibles stacks y un valor de la tabla de flags a cualquier usuario autenticado.
- El diagnóstico administrativo usa un token estático y no `withAdminAuth`; actualmente devuelve build, no una operación crítica. Un comentario de desarrollo se entrega en el HTML del panel.
- **Corrección:** retirar contraseñas y flags de respuestas, usar identificadores de error correlacionables solo con logs protegidos, eliminar debug en producción y exigir autorización real. No devolver stacks ni rutas.

### M-09 — Redirección arbitraria tras login

**CWE:** CWE-601 · **Referencias:** `app/login/LoginForm.tsx:15-43`; `lib/validation/schemas/auth.ts:11-15`.

- `redirect` procede de la query y se asigna directamente a `window.location.href` después de autenticar. No hay allowlist ni restricción a rutas locales; esquemas no HTTP deben rechazarse explícitamente.
- **Impacto:** phishing con un flujo de login legítimo y navegación a destinos o esquemas peligrosos. No se afirma una ejecución concreta de `javascript:` sin prueba de navegador.
- **Corrección:** aceptar únicamente rutas relativas normalizadas de la aplicación o IDs de destino. Rechazar URLs absolutas, `//`, barras invertidas y esquemas; no enviar este valor a lógica OAuth sin validación.

### M-10 — API key persistente en localStorage y mensaje de privacidad engañoso

**CWE:** CWE-922 · **Referencias:** `app/support/ai-assistant/AIAssistantChat.tsx:24-54,75-85,139-143,221-229`.

- La clave Mistral se guarda indefinidamente en localStorage y se envía al backend. Cualquier XSS del mismo origen —existen H-03/M-04— puede leerla.
- La interfaz afirma que la clave no saldrá de la instancia local, aunque el servidor la usa como Bearer hacia Mistral; en un despliegue remoto esa descripción no es correcta.
- **Corrección:** evitar persistencia o mantenerla solo en memoria; preferir un backend con secreto gestionado, autorización y cuotas. Explicar claramente los destinatarios y minimizar registros. Corregir XSS antes de tratar datos sensibles en el navegador.

### M-11 — Contenedor con root, toolchain y dependencias de desarrollo

**CWE:** CWE-250, CWE-1104 · **Referencias:** `Dockerfile:1-34`.

- No hay `USER`; se instalan compiladores y cabeceras nativas y `npm ci` incluye desarrollo en la imagen final. No hay separación build/runtime, lo que aumenta privilegios y superficie tras un RCE.
- La imagen base se referencia por etiqueta mutable, no por digest.
- **Corrección:** build multietapa, solo artefactos y dependencias de producción, usuario no privilegiado, filesystem de solo lectura cuando sea viable, capabilities mínimas, secretos en runtime y digest fijado/actualizaciones de base. Mantener volúmenes con permisos mínimos.

## 6. Hallazgo de severidad baja

### L-01 — Falta de cabeceras y controles complementarios de navegador

**CWE:** CWE-693, CWE-1021 · **Referencias:** `next.config.ts:3-17`; `app/api/monitoring/auth/route.ts:16-20`; tokens en query en `app/api/user/support-access/route.ts:82-91`.

- No se configuran CSP, `frame-ancestors`/anti-clickjacking, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` ni HSTS en la aplicación. La cookie SIEM tampoco declara `Secure`/`SameSite`.
- La cookie principal sí usa `HttpOnly`, `Secure` en producción y `SameSite: lax`, lo que mitiga CSRF cross-site convencional, pero no sustituye validación `Origin`/tokens en operaciones sensibles ni resuelve el login por GET.
- **Corrección:** definir cabeceras globales y por recurso, CSP sin `unsafe-inline` cuando sea viable, `nosniff`, referrer estricto y anti-framing; HSTS en el terminador TLS. Unificar cookies seguras, usar POST para cambios de sesión y añadir defensas CSRF según arquitectura.

## 7. Dependencias y cadena de suministro

### Resultados

| Auditoría | Críticos | Altos | Moderados | Bajos | Total de paquetes con avisos |
|---|---:|---:|---:|---:|---:|
| Completa | 2 | 13 | 16 | 2 | 33 |
| Omitiendo dev | 2 | 11 | 8 | 0 | 21 |

Estas cifras son entradas agregadas de `npm audit`, **no 33 CVE independientes ni 33 vulnerabilidades remotas demostradas**. Los detalles, rutas de dependencia y enlaces GHSA están en los JSON.

| Dependencia directa | Versión bloqueada | Resultado relevante | Acción |
|---|---:|---|---|
| `next` | 15.2.2 | Crítica; múltiples avisos, incluidos RCE y bypass de middleware. | Actualizar al menos a 15.5.29 con regresión completa (C-09). |
| `zod` | 4.4.1 | Alta por agotamiento de memoria con colecciones restringidas sobredimensionadas. | Actualizar a una versión corregida (`>=4.6.6` según audit) y limitar cuerpos/colecciones. |
| `prisma` | 6.19.3 | Alta vía `@prisma/config`, `deepmerge-ts` y `effect`; principalmente tooling/config. | Planificar actualización coordinada; audit sugiere 7.10.1, que es cambio mayor. |
| `libxmljs2` | 0.37.0 | Moderada por cadena nativa de build; el XXE de H-05 es además un fallo propio de configuración. | Reevaluar la dependencia/parser y actualizar la cadena sin aplicar downgrades automáticos a ciegas. |
| `@tailwindcss/typography` | 0.5.19 | Moderada vía parser de selectores. | Actualizar lockfile a versiones corregidas compatibles y comprobar build. |

También aparecen `tar` (crítica, transitiva), `sharp`, `postcss`, `js-yaml`, `brace-expansion`, `browserslist`, `nanoid`, `source-map-js` y otras. Su explotabilidad varía entre runtime, procesamiento de imágenes, build y herramientas de desarrollo; priorizar las rutas de producción sin ignorar compromisos de CI.

**Recomendación:** actualizar primero Next/React y Zod en una rama controlada, ejecutar build/lint/pruebas y revisar los avisos restantes por alcanzabilidad. Evitar `npm audit fix --force`: propone cambios mayores y, en algunos casos, sustituciones que requieren análisis.

## 8. Controles positivos observados

- Las cookies principales usan `HttpOnly`, `SameSite: lax` y `Secure` en producción (`lib/server-auth.ts:71-88`).
- Existen wrappers `withAuth`/`withAdminAuth` y numerosas rutas administrativas los utilizan; el problema es la confianza/secreto subyacente y las excepciones señaladas.
- Varias operaciones de carrito/listas comprueban correctamente propiedad; el POST para compartir pedidos también filtra por `userId`.
- El canje de tarjetas usa actualización condicionada para impedir el doble canje concurrente básico; falta atomicidad con el saldo.
- Los tokens de soporte se generan con `crypto.randomBytes(32)`; el fallo está en a quién se asignan y en no comprobar revocación.
- Next Image restringe hosts remotos y hay lockfile con integridades. Estas medidas no compensan las rutas vulnerables.

## 9. Plan de remediación

### 0–48 horas: contención y rotura de cadenas críticas

1. Aislar el servicio y preservar evidencias; revisar accesos y datos modificados.
2. Retirar/rotar secretos, claves de streaming, tokens y contraseñas; invalidar sesiones. Tratar los logs como comprometidos.
3. Corregir C-01, C-02, C-03, C-04 y C-08. Probar explícitamente que no se puede crear/administrar otra cuenta.
4. Desactivar temporalmente C-05/C-06/C-07, flags públicos, XML, SSRF, MCP/AI y SVG si no hay corrección inmediata.
5. Recalcular pedidos y exigir pago verificado en servidor (C-10).
6. Actualizar Next.js a una versión corregida y verificar el despliegue (C-09).

### Primera semana: controles estructurales

- Parametrizar todo SQL; centralizar autorización por objeto y rol con pruebas de dos usuarios.
- Aplicar egress/allowlists y timeouts; eliminar XXE y cualquier HTML activo.
- Migrar contraseñas a Argon2id, limpiar logs y proteger SIEM con sesiones reales/MFA/red.
- Hacer transaccionales pedidos/cupones/tarjetas; conciliar saldos y consumos.
- Reemplazar tokens de compartición por AEAD/firma con caducidad y revocación.

### Antes de producción

- Separar por completo laboratorio y producción; no distribuir `.env*`, flags, seed ni datos reales.
- Endurecer imagen, permisos, cabeceras, límites, rate limiting y rotación de logs.
- Añadir pruebas de seguridad para registro de rol, reset predecible, soporte cruzado, IDOR, SQLi, traversal, SSRF, XXE y XSS.
- Integrar en CI análisis de dependencias, secretos, SAST y pruebas de regresión; revisar historial si se recupera el repositorio Git.
- Realizar una retest dinámica en un entorno aislado con datos ficticios y cuentas de distintos privilegios.

## 10. Criterio de aceptación para cierre

No cerrar únicamente porque desaparezcan mensajes de herramientas. Se debe demostrar que:

- no existe secreto por defecto ni rol asignable por el cliente;
- recuperación y soporte no permiten acceso cruzado y revocan correctamente;
- todas las consultas usan parámetros y todas las rutas sensibles autorizan objeto y acción;
- archivos/URLs/XML no pueden salir de su alcance;
- pedidos, cupones y tarjetas son recalculados, pagados y confirmados en servidor;
- logs no contienen credenciales y SIEM no acepta secretos/cookies estáticos;
- Next/Zod y las dependencias de producción no presentan avisos críticos/altos aplicables;
- las pruebas automatizadas de abuso pasan y una retest independiente no reproduce los hallazgos.
