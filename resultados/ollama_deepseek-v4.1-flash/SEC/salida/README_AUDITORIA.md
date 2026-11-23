# Auditoría de Seguridad — Quokka Bazaar

Este directorio contiene los entregables de la auditoría de seguridad realizada sobre el proyecto `quokka-bazaar` v2.17.0.

## Entregables

| Fichero | Descripción |
|---|---|
| [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md) | Informe completo en español: resumen ejecutivo, 38 hallazgos detallados con severidad, CVSS, CWE/OWASP, ubicación, impacto, PoC y remediación, además del inventario de flags/secretos y plan de remediación. |
| [`hallazgos.json`](./hallazgos.json) | Los 38 hallazgos en formato estructurado (JSON) para integración con herramientas de gestión de vulnerabilidades. |
| [`flags_encontrados.csv`](./flags_encontrados.csv) | Inventario de los 35 marcadores/flags sembrados, con su dificultad y el vector o fichero donde se localizaron. |

## Cifras clave

- **38 hallazgos**: 8 críticos, 19 altos, 8 medios y 3 bajos.
- **35 flags** localizados (todos expuestos además sin autenticación vía `GET /api/flags`).
- **Rutas más críticas**: `/api/flags`, `/api/files`, `/api/products/search`, `/api/orders/search`, `/api/auth/signup`, `/api/user/support-access`, `/api/auth/support-login`, `/api/mcp`.

## Aviso

El proyecto es un entorno de laboratorio/CTF: los valores `QKB{...}` son marcadores de explotación y no secretos reales de clientes. Aun así, las vulnerabilidades descritas son reales y deben corregirse antes de cualquier despliegue en producción.

## Cómo leer el informe

1. Empieza por el **resumen ejecutivo** y la **tabla de hallazgos** de `SECURITY_AUDIT.md`.
2. Revisa el **detalle** de los hallazgos críticos y altos.
3. Usa el **plan de remediación priorizado** (sección 6) como hoja de ruta.
4. Los **PoC** son para validación en un entorno autorizado, nunca contra producción.
