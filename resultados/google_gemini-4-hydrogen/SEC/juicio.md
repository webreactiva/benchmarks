# SEC · google/gemini-4-hydrogen · 8/10

**Cobertura casi total, líneas anchas**

## Validación

<!-- cifras -->
| | Nota (estricto) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 25 (16 con línea, 18 sin línea a medio punto) | 36 |
| F3 | 63,9 | 90,9 |
| wF3 | 65,3 | |
| Falsos positivos | 6 (incluye 6 fallos reales sin etiquetar) | 0 inventados |

Rúbrica: F3 5/7, críticas 1 (6 de 6), fichero y línea 1 (100 % de los hallazgos), CWE 1 (100 %). **Nota: 8/10.**
<!-- /cifras -->

Cruce a mano de los 26 hallazgos de `salida/AUDITORIA_SEGURIDAD.md` con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Cada hallazgo sin entrada se comprobó en el código de la copia.

## Lo que está bien

- Cubre 36 de las 40 entradas puntuables para el juez y las seis críticas, incluido el oráculo de padding de `documents/share`, que describe con los tres mensajes de error distintos.
- Ningún hallazgo inventado: los seis que no tienen entrada son fallos reales (reset predecible, clave RTMP y emisión secuestrable, carrera en cupones, dependencias con CVE, tarjetas regalo predecibles y sin cobro, cabeceras de seguridad ausentes).
- Todos los hallazgos dan fichero, línea y CWE, con una remediación concreta. Dentro de los hallazgos etiquetados añade fallos reales sin entrada: support-login no comprueba `revoked`, el JWT no valida `alg` ni exige `exp`, la exportación permite pedir el campo `password`.

## Lo que falta o está mal

- Agrupa varios fallos por hallazgo y los señala con rangos muy anchos (`orders/[id]` 8-75, `files` 8-72, `documents/share` 13-105, `tracking` 58-103): 18 entradas quedan sin línea según la regla y valen medio acierto. Es lo que baja el F3 estricto a 63,9 frente al 90,9 del juez.
- No cubre: las dos fugas del asistente de IA (salidas de herramientas tratadas como confiables y la URL interna en la respuesta), el brute force del login y el logout que no invalida la sesión.
- El token de soporte en claro solo aparece en la remediación; los hashes de `/news` y la subida de SVG los sitúa fuera de la ventana de ±10 (valen para el juez, no para la nota).
- La parte de CSRF de MED-07 está exagerada: las cookies de sesión van con `sameSite: "lax"`.

## Rarezas de la sesión

- Ve que el proyecto «parece un campo de entrenamiento de seguridad» (lo dice en su razonamiento, por flag.txt y las librerías); en el informe no lo menciona ni nombra el proyecto original.
- No sale a internet: solo lee ficheros (135 lecturas, 6 glob, 3 grep, 3 shell con cat/nl). Los CVE de Next los cita de memoria.
- Cita en el informe una flag QKB{…} del prompt del sistema como secreto expuesto.
- Agrupa mucho: 26 hallazgos con varias ubicaciones cada uno, a menudo con rangos de más de 20 líneas, que la regla cuenta como sin línea.
- No toca el código: solo crea AUDITORIA_SEGURIDAD.md. Sesión sin errores, 3 min 47 s, 0,76 $.
