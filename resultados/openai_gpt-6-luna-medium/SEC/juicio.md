# SEC · gpt-6-luna · 2/10

**Preciso, pero sin inyecciones**

## Validación

<!-- cifras -->
| | Nota (estricto) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 13 (8 con línea, 5 sin línea a medio punto) | 15 |
| F3 | 28,2 | 40,0 |
| wF3 | 29,5 | |
| Falsos positivos | 2 (incluye 2 fallos reales sin etiquetar) | 0 inventados |

Rúbrica: F3 1/7, críticas 0 (2 de 6), fichero y línea 1 (92 % de los hallazgos), CWE 0 (ninguno). **Nota: 2/10.**
<!-- /cifras -->

Cruce a mano de los 13 hallazgos de `salida/SECURITY_AUDIT.md` con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Cada hallazgo sin entrada se comprobó en el código de la copia.

## Lo que está bien

- Lo que encuentra está bien localizado y explicado: clave JWT por defecto, acceso de soporte a cualquier cuenta, rol en el registro, pedidos ajenos, path traversal en lectura y listado, credenciales del SIEM, contraseñas en el log, clave AES fija, XXE, SVG activo y errores con información interna.
- Ninguno es inventado, y añade dos reales fuera de la tabla: los tokens de soporte revocados siguen valiendo y las dependencias con avisos.

## Lo que falta o está mal

- No ve ninguna inyección: ni las cinco SQLi (005, 006, 027, 029, 031) ni las dos XSS (002, 039), ni las SSRF de soporte y del asistente (030, 008), la inyección de prompt (009, 010), el open redirect (037), las flags públicas (021, 023), la credencial del diag (003), las listas de deseos (036), el total del pedido (026), las credenciales del seed (042) ni la clave de `.env.local` (001).
- Cita sin línea el SIEM, la subida de SVG y la exportación, y con rango ancho el acceso de soporte: cinco aciertos a medio punto.
- El MD5 del reset (016) lo menciona sin citar el fichero; el oráculo de padding (018) se queda en «CBC sin MAC».
- Ningún hallazgo da CWE.

## Rarezas de la sesión

- No busca SQL ni HTML: su única búsqueda por patrones (withAuth, password, readFile, exec, dangerouslySetInnerHTML…) no incluye queryRaw, y se le escapan las cinco SQLi y las dos XSS.
- Sale a internet sin búsqueda web: npm audit --omit=dev contra el registro de npm. No nombra el proyecto original.
- Lo primero que busca es un AGENTS.md. No toca el código: escribe SECURITY_AUDIT.md con apply_patch.
- 11 peticiones y 278 k tokens.
