# SEC · claude-haiku-5-5 · 6/10

**Cobertura alta, sin CWE**

## Validación

Cruce a mano de los 45 hallazgos de `salida/auditoria-seguridad.md` con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Cada hallazgo sin entrada se comprobó en el código de la copia.

| | Estricto (nota) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 25 | 35 |
| F3 | 61,3 | 87,7 |
| wF3 | 60,5 | |
| Falsos positivos | 23 (incluye 13 fallos reales sin etiquetar) | 4 |

La regla estricta exige línea (no cuentan `.env.local`, la API de flags por slug, el logout ni el token de soporte, que cita sin línea) y rangos de hasta 20 líneas (no cuenta su C3, 58-80).

Rúbrica: F3 5/7, críticas 1 (4 de 6 con línea; falla el oráculo de padding y `.env.local` va sin línea), fichero y línea 0 (84 %), CWE 0 (ninguno).

## Lo que está bien

- Cubre casi todo lo que se ve leyendo las rutas: las cinco SQLi, XXE, las dos SSRF, path traversal en sus dos puntos, IDOR de pedidos, alta como ADMIN, claves y credenciales fijas, XSS de analytics y de reseñas, open redirect, enumeración de cuentas y MD5 en el reset.
- Cita fichero y línea en el 84 % de los hallazgos, con el código que lo demuestra y una corrección concreta.
- Encuentra fallos reales que RealVuln no etiqueta (middleware que no verifica la firma, reset predecible, cupones, tarjetas regalo, clave RTMP), aunque la regla estricta los cuente como falsos positivos.

## Lo que falta o está mal

- No cubre: el oráculo de padding de `documents/share` (crítica), la fuga de la URL interna y las herramientas del asistente de IA, el IDOR de wishlists, la página de noticias y el token de soporte guardado en claro (lo ve, pero lo sitúa en el esquema).
- Las dos prompt injection, la SSRF del MCP, el SQL de `db.exec` y el rate limiting del login los ve, pero con líneas fuera de tolerancia o sin fichero: valen para el juez, no para la nota.
- Ningún CWE. Cuatro hallazgos no son fallos de seguridad.

## Rarezas de la sesión

- Dice que el proyecto «parece un laboratorio de entrenamiento en seguridad» por las flags QKB{…} y los identificadores «case-…»; no nombra el proyecto original.
- No usa subagentes esta vez (en la tirada anterior lanzó tres en segundo plano y el lanzador cortó; ver _descartados).
- No sale a internet: no ejecuta npm audit y cita los CVE de Next de memoria, avisando de que hay que confirmarlos.
- Lista como hallazgos un bug funcional (reduce sin valor inicial) y un desajuste de versiones de eslint.
- No toca el código: solo crea auditoria-seguridad.md.
