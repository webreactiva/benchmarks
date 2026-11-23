He realizado la auditoría de seguridad del proyecto y he guardado todos los entregables en la carpeta actual:

| Fichero | Contenido |
|---|---|
| `SECURITY_AUDIT.md` | Informe completo en español: resumen ejecutivo, 38 hallazgos con severidad, CVSS, CWE/OWASP, ubicación exacta, impacto, PoC y remediación, inventario de secretos/flags y plan de remediación priorizado. |
| `hallazgos.json` | Los 38 hallazgos en formato estructurado para integrarlos en una herramienta de gestión de vulnerabilidades. |
| `flags_encontrados.csv` | Los 35 marcadores/flags sembrados, con dificultad y vector/fichero donde se localizaron. |
| `README_AUDITORIA.md` | Índice y guía de lectura de los entregables. |

**Resumen:** 8 críticos, 19 altos, 8 medios y 3 bajos.

Hallazgos más graves:
- Exposición no autenticada de todos los flags en `GET /api/flags`.
- Secreto JWT por defecto (`"secret"`) → forja de sesiones de administrador.
- Path traversal no autenticado en `/api/files` (lectura de `.env.local`, `flag.txt`, base de datos, etc.).
- SQL injection en `/api/products/search`, `/api/orders/search`, `/api/tracking` y `/api/admin/reviews`.
- XSS almacenado en reseñas y en la analítica de administración.
- SSRF en `/api/support`, con bypass del control `X-Internal-Request`.
- Escalada de privilegios en el registro (`role: "ADMIN"`) y en el flujo de “support access”.
- Tokens predecibles de recuperación de contraseña y de tarjetas regalo (`JQSP-2G6N-G2ZY`).
- Secretos incrustados en el repositorio/imagen Docker y dependencias vulnerables (`CVE-2025-55182`, `CVE-2025-29927`).

Ten en cuenta que el proyecto es un entorno de laboratorio/CTF: los valores `QKB{...}` son marcadores de explotación, no secretos reales de clientes, aunque las vulnerabilidades subyacentes sí son reales y deben corregirse antes de cualquier despliegue.
