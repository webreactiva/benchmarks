Voy a empezar explorando la estructura del proyecto para entender qué estamos auditando.

---

Es una aplicación Next.js (e-commerce). Voy a leer los archivos clave de seguridad en paralelo: configuración, autenticación, middleware, variables de entorno y rutas API.

---

Ya encontré hallazgos graves. Sigo examinando las rutas API, uploads, crypto y archivos sensibles.

---

Encontré varios problemas graves. Continúo con las rutas de autenticación, admin, monitoring y archivos de configuración sensibles.

---

Tengo un panorama completo del proyecto. Ahora voy a generar el informe de auditoría en la carpeta actual.

---

He completado la auditoría y guardado el informe en la carpeta actual: **`security-audit-report.md`**.

## Resumen de lo encontrado

El proyecto (Quokka Bazaar, e-commerce en Next.js 15.2.2 + Prisma + SQLite) tiene **17 hallazgos críticos, 9 altos, 7 medios y 6 bajos**. Los más graves:

**Críticos:**
- **SQLi** en 4 endpoints con `$queryRawUnsafe`/interpolación directa — dos de ellos **públicos** (`/api/products/search?q=`, `/api/tracking` vía `X-Forwarded-For`)
- **XXE** en la importación XML de proveedores (`libxmljs2` con `noent/dtdload`)
- **Mass assignment**: el signup acepta `role: "ADMIN"` desde el cliente
- **JWT con secreto por defecto `"secret"`** → falsificación de tokens admin
- **MD5 sin salt** para contraseñas; **contraseñas en texto plano en los logs**
- **Path traversal** sin auth en `/api/files` (expone `.env.local`, la BD, etc.)
- **XSS almacenado**: reviews con `innerHTML` + re-ejecución de `<script>`; IPs inyectadas en el panel admin vía `dangerouslySetInnerHTML`; subida/servicio de SVG
- **SSRF** en `/api/support` y en el asistente de IA (acepta `mcpServerUrl` del usuario y filtra flags vía MCP)
- **Secretos commiteados**: `.env.local` (no está en `.gitignore`/`.dockerignore`), `supplier-registry.txt`, `flag.txt`, `public/notice.txt`, 35+ flags en `prisma/seed.ts`, credenciales SIEM `root/admin`, tokens hardcodeados
- **Next.js 15.2.2 vulnerable a CVE-2025-55182 (RCE)** — confirmado por el propio `FLAG_CVE_2025_55182` del entorno
- Endpoints de flags y documentos compartidos **sin autenticación** (tokens AES-CBC forgeables con clave por defecto)

**Altos:** IDOR en pedidos/wishlists, middleware que no verifica la firma del JWT, página "interna" protegida por una cabecera que el cliente puede enviar, tokens predecibles (gift cards LCG, reset MD5), sesiones de soporte de 365 días creables para terceros, fuga de stacks/flags en errores de `/api/user/export`, condición de carrera en cupones, sin rate limiting/CSRF/cabeceras de seguridad.

El informe incluye la matriz de control de acceso por endpoint, la lista completa de secretos a **rotar inmediatamente**, y un plan de remediación priorizado (P0 hoy / P1 esta semana / P2 este mes).
