Voy a revisar el formato de las incidencias y clasificar cada línea según el tipo, la superficie y las áreas indicadas. Luego guardaré el resultado en `clasificacion.jsonl`.

---

El archivo contiene 300 incidencias. Estoy extrayendo títulos y descripciones para cubrirlas todas; usaré varias áreas cuando la incidencia afecte claramente a más de una.

---

Clasifiqué las 300 incidencias y guardé el resultado, una línea JSON por incidencia con su `id`, en [clasificacion.jsonl](/private/var/tmp/bench/ws-dwqmppwJ/clasificacion.jsonl). Verifiqué que hay 300 IDs únicos. Las incidencias retiradas o sin contenido clasificable tienen `areas: []`.
