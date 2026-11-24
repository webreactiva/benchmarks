# Auditoría de seguridad

**Fecha:** 24 de noviembre de 2026  
**Alcance:** revisión estática del código de la aplicación, autenticación/autorización, API, configuración de contenedores y dependencias de producción. No se ejecutaron pruebas de intrusión ni se desplegó el servicio.  
**Resultado:** riesgo global **crítico**. Los hallazgos P0 y P1 requieren corrección antes de exponer el servicio a Internet.

## Hallazgos

### P0 — La clave de sesión predeterminada permite falsificar cuentas y roles

`lib/server-auth.ts:12,31-40` firma y valida todas las sesiones con `JWT_SECRET || "secret"`. Si `JWT_SECRET` no está configurada, cualquier persona que conozca el código puede generar cookies válidas con `role: "ADMIN"`; no se comprueba además que el usuario siga existiendo o conserve ese rol. Los controles `withAuth` y `withAdminAuth` dependen de esta validación.

**Corrección:** fallar al iniciar si falta una clave aleatoria de alta entropía; rotar la clave y revocar sesiones existentes. Validar firma/algoritmo, expiración y estado/rol actual del usuario en servidor.

### P0 — Cualquier usuario puede crear acceso de soporte a la cuenta de otra persona

`app/api/user/support-access/route.ts:51-90` permite a un usuario autenticado indicar cualquier `email`, crea un token ligado a esa cuenta y devuelve el token/login URL. `app/api/auth/support-login/route.ts` intercambia ese token por una sesión de la cuenta objetivo. Un usuario puede, por tanto, suplantar a otras personas —incluidos administradores— y acceder a sus privilegios.

**Corrección:** restringir la emisión de accesos entre cuentas a personal autorizado con auditoría y aprobación; para el uso propio, ignorar el correo proporcionado y ligar el token al usuario autenticado. Revocar los tokens potencialmente emitidos y revisar su historial.

### P1 — Escalada a administrador durante el registro

`app/api/auth/signup/route.ts:48-61` copia `body.role` directamente a la cuenta; `signupBodySchema` permite `role` como cadena. Basta registrarse con `role: "ADMIN"` para recibir una sesión administrativa.

**Corrección:** asignar el rol normal exclusivamente en el servidor y descartar/rechazar ese campo del cuerpo. Revisar y degradar cuentas creadas con roles no autorizados.

### P1 — Lectura de pedidos ajenos expone datos personales y dirección

`app/api/orders/[id]/route.ts:8-22,28-55` exige una sesión, pero busca por `id` solamente y devuelve correo y dirección del comprador. Un usuario autenticado que obtenga o adivine otro ID puede consultar su pedido.

**Corrección:** incluir `userId: user.id` en la consulta; permitir acceso de administradores con una rama explícita y comprobar la propiedad antes de devolver datos.

### P1 — Lectura y listado de archivos sin autenticación con traversal de rutas

`app/api/files/route.ts:17-21,49-67` no requiere autenticación y concatena `path`/`file` con `documents` sin comprobar que la ruta resuelta siga dentro del directorio. Valores con `../` pueden leer archivos del sistema o secretos del proceso; también se puede listar directorios. Los PDFs se sirven inline.

**Corrección:** retirar el endpoint si no es necesario; si lo es, exigir autorización, canonicalizar (`realpath`) y validar el prefijo/directorio permitido, y aplicar límites de tamaño/tipo y `Content-Disposition: attachment` donde corresponda.

### P1 — Credenciales SIEM estáticas y sesión falsificable exponen registros

`app/api/monitoring/auth/route.ts` y `app/api/monitoring/logs/route.ts:7-23,40-60` usan `root:admin`; el endpoint de logs acepta también una cookie cuyo valor constante es `authenticated`. Cualquiera puede leer el registro completo, que incluye información operativa y credenciales de inicio de sesión.

**Corrección:** eliminar credenciales por defecto; usar autenticación administrativa real, cookies firmadas y `Secure`/`SameSite`; limitar acceso a la red interna y sanear/rotar los logs expuestos.

### P1 — Contraseñas débiles de recuperar cuenta, almacenadas con MD5 y registradas en claro

`lib/server-auth.ts:14-15`, `app/api/auth/login/route.ts:16-27` y rutas de alta/restablecimiento usan MD5 sin sal. El login escribe la contraseña en claro en el log. Además, `app/api/auth/forgot-password/route.ts:15-35` deriva el token de `MD5(email + timestamp en segundos)`, sin secreto ni aleatoriedad: se puede predecir con el correo y el momento de solicitud. La exportación permite devolver el hash de contraseña (`app/api/user/export/route.ts`, `ALLOWED_USER_FIELDS`).

**Corrección:** Argon2id o bcrypt con sal y parámetros actuales; nunca registrar contraseñas ni incluir hashes en exportaciones. Tokens de restablecimiento aleatorios criptográficos, de un solo uso, con expiración, almacenamiento como hash y entrega por canal verificado. Invalidar sesiones tras restablecer la contraseña.

### P1 — Clave criptográfica de enlaces compartidos publicada y cifrado sin autenticación

`lib/share-crypto.ts:3-10` usa una clave AES fija conocida como alternativa. Los tokens son AES-256-CBC sin MAC; CBC no garantiza integridad. Si no se configura `SHARE_ENCRYPTION_KEY`, cualquiera puede crear/envenenar tokens y el servidor no puede verificar su autenticidad de forma segura.

**Corrección:** exigir una clave secreta nueva fuera del repositorio y usar AES-GCM o tokens aleatorios opacos ligados a recursos, con expiración y revocación. Rotar/inutilizar enlaces existentes tras el cambio.

### P1 — Tokens de soporte revocados siguen autenticando

`app/api/auth/support-login/route.ts` comprueba token y fecha de expiración, pero no el campo `revoked`. La revocación en `app/api/user/support-access/route.ts` no invalida el login; además los accesos duran un año.

**Corrección:** buscar únicamente tokens no revocados, invalidarlos después del primer uso si el flujo lo permite, acortar su duración y revocar los actualmente activos tras corregir.

### P1 — Parser XML habilita entidades externas y carga de DTD

`app/api/admin/suppliers/import-order/route.ts:21-24` activa `noent` y `dtdload`. Un XML malicioso presentado a una cuenta admin puede provocar XXE, lectura de archivos del servidor o solicitudes desde el servidor; el tamaño del cuerpo tampoco está limitado explícitamente.

**Corrección:** deshabilitar DTD y entidades externas, imponer tamaño máximo y tiempo límite, y no devolver errores internos al cliente.

### P2 — Carga de SVG activa contenido ejecutable bajo el mismo origen

`app/api/admin/products/[id]/image/route.ts` acepta `image/svg+xml` basándose en el MIME declarado y los sirve desde `/api/uploads/...` con `image/svg+xml` (`app/api/uploads/[...path]/route.ts`). Un SVG activo cargado por un administrador puede ejecutar contenido en el origen del sitio si se abre directamente.

**Corrección:** rechazar SVG o sanearlo con una biblioteca adecuada; validar el tipo real del contenido, añadir `X-Content-Type-Options: nosniff` y servir medios desde un origen aislado.

### P2 — Errores y exportación revelan información interna

`app/api/user/export/route.ts:77-91,120+` devuelve diagnósticos, stack/error de base de datos y un valor de feature flag ante errores/campos inválidos. `app/api/admin/suppliers/import-order/route.ts` incluye rutas del servidor y mensajes del parser en respuestas. Esto facilita reconocimiento y puede revelar información sensible.

**Corrección:** respuestas genéricas y un identificador de incidente; diagnósticos solo en logs internos protegidos y saneados.

### P2 — Dependencias de producción con avisos de seguridad

`npm audit --omit=dev --json` (24-11-2026, contra el advisory feed disponible) reportó **21 vulnerabilidades** en el árbol de producción: **2 críticas, 11 altas y 8 moderadas**. Entre los paquetes señalados aparecen `next` (fijado en `15.2.2`), `zod` (rango afectado `<4.6.6`), `tar`, `@prisma/config` y dependencias transitivas. La salida indica correcciones disponibles en varios casos; revisar cada advisory y compatibilidad antes de actualizar.

**Corrección:** actualizar Next y dependencias directas/transitivas a versiones corregidas, regenerar el lockfile, ejecutar pruebas de compatibilidad y añadir auditoría de dependencias al pipeline. No aplicar `npm audit fix --force` sin revisar cambios incompatibles.

## Orden recomendado de respuesta

1. Deshabilitar temporalmente registro con rol, emisión de soporte entre usuarios, exportación de logs y lectura pública de archivos; cerrar el acceso externo mientras se despliegan mitigaciones.
2. Reemplazar secretos predeterminados; rotar claves, sesiones, tokens y credenciales que pudieron exponerse. Investigar logs y actividad de administración.
3. Corregir controles de acceso de pedidos/soporte, restablecimiento de contraseña, rutas de archivos y parser XML.
4. Migrar hashes de contraseñas con un flujo seguro, depurar logs y actualizar dependencias vulnerables.
5. Repetir la auditoría con pruebas de autorización negativas, traversal, XXE, autenticación y dependencias.

## Limitaciones

Esta auditoría es estática y se basa en el código y lockfile presentes en el repositorio. `npm audit` consultó el registro de avisos vigente en el momento de la ejecución. No se verificó el despliegue, variables de entorno reales, exposición de red, base de datos ni comportamiento en runtime. Los hallazgos deben confirmarse tras aplicar correcciones; la ausencia de otros hallazgos no equivale a ausencia de vulnerabilidades.
