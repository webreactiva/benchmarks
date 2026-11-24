Voy a hacer una auditoría de seguridad del proyecto. Primero exploro la estructura para entender con qué estamos trabajando.

---

Es un proyecto Next.js (e-commerce) con bastantes rutas API. Voy a analizar los archivos clave: configuración, middleware, autenticación y rutas sensibles.

---

Es un proyecto tipo e-commerce Next.js 15 con Prisma/SQLite. Ahora leo los archivos críticos de seguridad: auth, configuración y rutas API sensibles.

---

Ya veo varios problemas iniciales (secrets en `.env.local`, JWT con fallback débil, MD5). Sigo con las rutas de autenticación y las más sensibles.

---

Detecto ya varios hallazgos serios (log de contraseñas en claro, privilegio por mass-assignment, token de reset predecible). Sigo con los esquemas de validación y el resto de rutas API.

---

Ya tengo una visión completa. Verifico un par de esquemas de validación para confirmar los hallazgos de inyección SQL y luego genero el informe.

---

Antes de redactar el informe, verifico el `.dockerignore` y los clientes de administrador restantes para no dejar nada sin cubrir.

---

El análisis del código está completo. Genero ahora el informe de auditoría y el resumen estructurado de hallazgos.

---

Ahora el resumen estructurado en JSON:

---

Detecto una inconsistencia en los totales del resumen (37 hallazgos, no 38). Lo corrijo en ambos archivos:

---

Auditoría completada. He revisado manualmente las 58 rutas API, el middleware, las librerías de autenticación/criptografía, los esquemas de validación, el seed y la configuración Docker, y he guardado los entregables en la carpeta actual:

## Entregables generados

- **`AUDITORIA-SEGURIDAD.md`** — Informe completo (resumen ejecutivo, metodología, 37 hallazgos con severidad/CWE/ubicación/PoC/recomendación, matriz resumen, plan de remediación P0-P2, aspectos positivos y cadenas de ataque)
- **`hallazgos.json`** — Resumen estructurado y legible por máquinas (37 hallazgos, cadenas de ataque, plan de remediación)

## Resultado global: 🔴 RIESGO CRÍTICO

**37 hallazgos: 10 críticos · 15 altos · 7 medios · 5 bajos.** Los más graves:

| Hallazgo | Impacto |
|---|---|
| **V-01** Registro acepta `role:"ADMIN"` | Cualquiera se hace admin al registrarse |
| **V-02** IDOR en tokens de soporte | Suplanta cualquier cuenta (incluida la admin), sin contraseña |
| **V-03/V-04** SQLi sin autenticación (`products/search`, `tracking`) | Volcado completo de la BD |
| **V-07** Path traversal sin auth en `/api/files` | Lee `.env.local`, facturas con PII, cualquier archivo |
| **V-08** XXE en import XML (`noent+dtdload`) | Lectura de archivos/SSRF desde la consola admin |
| **V-09** Contraseñas en claro en logs + SIEM `root:admin` con cookie falsificable | Fuga de credenciales de todos los usuarios |
| **V-10** Token de reset = `MD5(email+timestamp)` y el timestamp se devuelve | Toma de cualquier cuenta |
| **V-11** `JWT_SECRET` por defecto `"secret"` | Forja de tokens admin |

Además: XSS almacenado en el panel admin (V-17), SSRF sin autenticar en soporte y en el asistente IA con prompt injection (V-12/V-19), total del pedido controlado por el cliente (V-23), códigos de gift card predecibles (V-24), Next.js 15.2.2 con CVE-2025-29927 de bypass de middleware (V-25) y secretos filtrados en repo/bundle/imagen Docker (V-27).

El informe incluye 4 **cadenas de ataque** que demuestran cómo combinarlos (p. ej. control admin total en 3 pasos sin credenciales) y un plan de remediación priorizado donde el bloque P0 son correcciones mayormente de 1-2 líneas.
