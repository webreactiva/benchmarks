Se ha realizado la auditoría de seguridad integral del proyecto **Quokka Bazaar (`v2.17.0`)** y se ha guardado el informe completo en la carpeta actual:

- **Archivo generado:** `AUDITORIA_SEGURIDAD.md`

### Resumen de Resultados

Se identificaron **22 hallazgos de seguridad** clasificados según severidad, CWE y OWASP Top 10:

- **8 Críticos:**
  - **SEC-01:** Dependencias base con vulnerabilidades críticas conocidas (`next@15.2.2`, `react@19.2.0` — RCE por deserialización en RSC `CVE-2025-55182` y evasión de middleware `CVE-2025-29927`).
  - **SEC-02:** Inyección SQL múltiple (`prisma.$queryRawUnsafe` y `db.exec` con consultas apiladas) en `/api/products/search`, `/api/tracking`, `/api/orders/search` y `/api/admin/reviews`.
  - **SEC-03:** Escalada de privilegios directa a `ADMIN` por *Mass Assignment* en `POST /api/auth/signup`.
  - **SEC-04:** Toma de control de cuentas arbitrarias (*Account Takeover*) al permitir generar tokens de soporte para correos de terceros en `POST /api/user/support-access` y no verificar `revoked` en `/api/auth/support-login`.
  - **SEC-05:** *Path Traversal* y listado de directorios sin autenticación en `GET /api/files`.
  - **SEC-06:** Inyección de Entidades Externas XML (XXE) con `noent: true` y `dtdload: true` en `POST /api/admin/suppliers/import-order`.
  - **SEC-07:** SSRF no autenticado en `POST /api/support` con inyección de la cabecera `X-Internal-Request: true` y control de acceso falsificable en `/internal`.
  - **SEC-08:** Secreto JWT por defecto (`"secret"`) en `lib/server-auth.ts` y ausencia total de verificación criptográfica de firma en `middleware.ts`.

- **7 Altos:**
  - **SEC-09:** Hashing de contraseñas con MD5 sin sal, registro de contraseñas en texto plano en `logs/app.log` y consola SIEM (`/monitoring/siem`) con credenciales por defecto (`root`/`admin`).
  - **SEC-10:** Tokens predecibles de restablecimiento de contraseña (`MD5(email + timestamp)`) junto con filtración de `requestedAt` en la respuesta de `/api/auth/forgot-password`.
  - **SEC-11:** Manipulación del precio total desde el cliente en `POST /api/orders` y condición de carrera (*TOCTOU*) en la redención de cupones.
  - **SEC-12:** Referencias directas inseguras a objetos (IDOR / BOLA y BFLA) en `GET /api/orders/[id]`, `GET /api/wishlists/[id]` y `GET/POST /api/live/stream`.
  - **SEC-13:** XSS almacenado, reflejado, basado en DOM y mediante carga de SVG en reseñas de productos, analíticas de administración, soporte, redirección de login y subida de imágenes.
  - **SEC-14:** Oráculo de relleno (*Padding Oracle*) y maleabilidad en `aes-256-cbc` (`lib/share-crypto.ts` y `/api/documents/share`), más PRNG lineal predecible en códigos de tarjetas de regalo (`lib/gift-card.ts`).
  - **SEC-15:** Secretos expuestos en el `SYSTEM_PROMPT` del asistente de IA, filtro de *Prompt Injection* trivial, SSRF / *Tool Poisoning* vía `mcpServerUrl` y cabecera estática hardcodeada en `/api/mcp`.

- **4 Medios y 3 Bajos:**
  - Falta de protección CSRF (`SEC-16`), secretos expuestos con `NEXT_PUBLIC_` y endpoints de depuración/diagnóstico (`SEC-17`), *Host Header Injection* (`SEC-18`), enumeración de usuarios y falta de *Rate Limiting* (`SEC-19`), contenedor Docker ejecutado como `root` e inclusión de `.env.local` (`SEC-20`), ausencia de cabeceras HTTP de seguridad (`SEC-21`) y exposición de Prisma Studio sin autenticación en `scripts/setup.sh` (`SEC-22`).

En `AUDITORIA_SEGURIDAD.md` encontrarás el detalle línea por línea de cada vulnerabilidad, su impacto y las medidas concretas de remediación organizadas por prioridad.
