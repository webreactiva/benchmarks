Voy a empezar revisando qué hay en el proyecto.

---

Es una aplicación Next.js de tamaño medio (223 archivos) con varias superficies sensibles: auth, admin, IA, MCP, subida de archivos y Docker. Empiezo por configuración, autenticación y middleware.

---

Hallazgos iniciales: JWT con secreto por defecto `"secret"`, clave AES de cifrado con valor por defecto en código, y el middleware solo decodifica el JWT sin verificar la firma. Sigo con las rutas de autenticación.

---

Ya tengo varios hallazgos críticos en autenticación y administración: registro con `role` controlable, XXE en la importación XML, endpoint de diagnóstico con token fijo, y tokens de reset predecibles. Ahora reviso subida de archivos, IA/MCP y el filtro de prompt injection.

---

He encontrado más problemas graves: `/api/files` parece aceptar rutas sin normalizar, la inyección SQL en `/api/tracking` usa `$queryRawUnsafe` con la IP sin escapar, y `/api/support` hace fetch a URLs arbitrarias. Antes de concluir, compruebo la validación de entrada y el esquema de Prisma.

---

Hallazgos adicionales: IDOR en `GET /api/orders/[id]` (cualquier usuario autenticado ve pedidos ajenos con datos personales) y en wishlists, SQL injection autenticada en `/api/orders/search`, y precio de pedido confiado del cliente. Ahora busco patrones peligrosos en todo el código.

---

Encontré una cadena de XSS almacenado: `/api/tracking` guarda el header `X-Forwarded-For` sin sanitizar, y la página de analytics lo renderiza con `dangerouslySetInnerHTML`. También hay un secreto de pago expuesto al cliente. Reviso esos puntos y las rutas restantes.

---

Confirmo varias exposiciones graves: `/api/files` no tiene autenticación y no normaliza la ruta, así que permite leer archivos arbitrarios; `/api/flags` devuelve todos los valores de los flags sin autenticación; y el secreto de checkout se envía al cliente. Reviso las rutas de productos, reseñas y wishlist.

---

Ya tengo una visión amplia. Antes de redactar, compruebo versiones de dependencias contra advisories conocidos y si el secreto de JWT está definido en algún sitio.

---

`npm audit` funciona. Saco el resumen de vulnerabilidades de dependencias, especialmente Next y React.

---

Tengo suficiente material. Para que el informe tenga referencias precisas, obtengo los números de línea de los puntos clave.

---

Tengo todo lo necesario. Guardo la salida de `npm audit` dentro del proyecto y redacto el informe en español.

---

El informe está escrito. Al revisarlo encuentro tres imprecisiones que corrijo: el recuento de medios (son 12, no 10), una frase confusa en B-04 y una referencia de línea en M-12 que no verifiqué.

---

He terminado la auditoría. El informe completo está en `/var/tmp/bench/ws-LrHcjTky/auditoria-seguridad.md` y la salida de `npm audit` en `/var/tmp/bench/ws-LrHcjTky/npm-audit.json`.

Es una revisión estática del código (no ejecuté la aplicación ni lancé exploits). El proyecto parece un laboratorio de formación deliberadamente vulnerable (tiene flags `QKB{...}` y comentarios como "The secure version uses…"). Aun así, cada punto es real en el código: si se expone fuera de un entorno aislado, es explotable. Los valores de flags y secretos están redactados en el informe.

## Resumen

- **Críticos: 11.** Los más graves:
  - **Admin sin credenciales:** el middleware no verifica la firma del JWT, y si no hay `JWT_SECRET` se usa `"secret"`, que es público. Cualquiera puede forjar una sesión ADMIN.
  - **Registro como ADMIN:** `/api/auth/signup` acepta `"role": "ADMIN"` en el body.
  - **Escalada por soporte:** cualquier usuario puede crear un token de soporte de 365 días para `admin@oss.com`, y el login de soporte no comprueba `revoked`.
  - **Takeover de cuentas:** el token de reset es `md5(email + timestamp)`, y la respuesta de `forgot-password` devuelve ese timestamp.
  - **Sin autenticación:** `/api/files` lee cualquier fichero (`file=../../.env.local`, la base de datos SQLite), `/api/products/search` y `/api/tracking` tienen SQL injection, y `/api/support` hace SSRF con reflejo de la respuesta.
  - **SIEM:** credenciales fijas `root/admin`, cookie constante `siem_session=authenticated`, y contraseñas en texto claro en `logs/app.log`.
  - **Dependencias:** Next.js 15.2.2 tiene CVEs críticos (RCE en React Flight, bypass de middleware). `npm audit` reporta 53 vulnerabilidades en total.
- **Altos: 12.** XSS almacenado vía IP en el panel de analytics, IDOR en pedidos y wishlists, tokens de compartición forjables con la clave por defecto del código, precio de pedido enviado por el cliente, cualquier usuario puede cambiar el stream en directo y leer la clave RTMP, XXE en la importación de pedidos, y `.env.local` copiado dentro de la imagen Docker (`.dockerignore` no lo excluye). El contenedor corre como root.
- **Medios: 12** y **bajos: 4**, con correcciones por cada uno.

## Prioridad

1. **Inmediato:** C-01, C-02, C-03, C-06, C-07, C-08, C-09. Rotar todos los secretos que aparecen en el repositorio.
2. **Después:** C-04, C-05, C-10, y los IDOR y XSS altos.
3. **Dependencias:** actualizar Next.js a 15.5.29 (la versión sugerida por npm) y revisar Prisma y Zod como cambios separados.

Si quieres, puedo preparar parches para los críticos de autenticación (C-01 a C-05) o verificar alguno de los hallazgos en un entorno aislado.
