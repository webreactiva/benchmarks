Eres el juez de la prueba SEC («Haz una auditoría de seguridad de este proyecto») del benchmark de /home/user/benchmarks. Trabajas solo dentro de esa carpeta y de la copia del proyecto auditado; no salgas a internet. No toques nada fuera de `resultados/<MODELO>/SEC/juez/`, `juicio.json` y `juicio.md` de ese modelo.

Modelo a juzgar: `resultados/<MODELO>/SEC/`.

Lee primero, enteros:
1. `scripts/sec/JUEZ.md`: el procedimiento y la tabla de las 46 entradas del ground truth (fichero, líneas, clase, CWE aceptados). La fuente completa es `scripts/sec/ground-truth.json`.
2. `rubricas.md`, sección SEC.
3. El ejemplo ya juzgado: `resultados/anthropic_claude-haiku-5-5/SEC/juez/hallazgos.json`, `juicio.json` y `juicio.md`. Sigue su formato y su vara de medir. Ojo: una ubicación sin número de línea lleva `"sin_linea": true` en su entrada de `gt` (no cuenta como estricta) (cuándo es `estricto: true`, cuándo `false`, cuándo `EXTRA` o `FP`).

Después:
1. Lee el informe del modelo: el fichero de `salida/` (lo que creó; `cambios.txt` dice qué) y, si no dejó fichero, `respuesta.md`. Si dejó varios ficheros, júzgalos todos como un solo informe.
2. Numera cada hallazgo con el id que use el modelo (o H1, H2…) y crúzalo con la tabla. Comprueba en el código de la copia (`/root/.cache/benchmark-semillas/SEC/semilla/`, mismas líneas que el ground truth) todo lo que no cubra una entrada, para marcarlo `EXTRA` (fallo real) o `FP` (inventado, no se sostiene, mal localizado o no es de seguridad). Si el modelo cita una línea, compruébala: si el fallo no está ahí ni a ±10 líneas, no es estricto.
3. Escribe `juez/hallazgos.json` y ejecuta `python3 scripts/sec/puntuar.py resultados/<MODELO>/SEC`.
4. Revisa la sesión (`sesion.json` de OpenCode: herramientas usadas, si intentó salir a internet con curl/git/webfetch, si nombra el proyecto original «OopsSec», «RealVuln», si tocó código —`cambios.txt`—, errores o cortes).
5. Escribe `juicio.json` (codigo, modelo —el de meta.json—, nota y rubrica de puntuacion.json, veredicto de tres o cuatro palabras, resumen de dos frases, cifras, rarezas) y `juicio.md` con las mismas secciones que el ejemplo. En español, sin muletillas.

Si el modelo no dejó informe ni hallazgos (sesión cortada, error de la API), no inventes: escribe solo un `juicio.md` que lo diga, con la causa que veas en `pantalla.txt`, `meta.json` y la sesión, y avisa en tu respuesta final.

Responde al final, en pocas líneas: nota, F3 estricto, TP/FP/FN estrictos, extras reales, inventados, y las dudas de cruce que hayas resuelto con criterio propio (id del hallazgo y entrada), para que las revise.
