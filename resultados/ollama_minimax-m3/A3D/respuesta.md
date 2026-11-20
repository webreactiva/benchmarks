Voy a crear la ruta 3D. Primero reviso el entorno:

---

Directorio vacío. Escribo el fichero por partes y lo uno al final.

---

Corrijo el fichero de datos del recorrido (salió con texto corrupto):

---

Ahora la parte principal: construcción del modelo 3D del conjunto.

---

Reajusto el trazado (añado Alcazaba y el puente) y reescribo los datos:

---

Ahora la escena, el recorrido animado y la interfaz:

---

Ajusto el terreno y las alturas; reescribo los módulos con las correcciones:

---

Encontrado: el primer `dt` era negativo (marca de tiempo del rAF anterior al arranque) y `u` se volvía negativo. Lo corrijo:

---

No puedo ver las imágenes, así que genero una vista ASCII del render para verificarlo:

---

Verifico analíticamente que el recorrido no queda enterrado dentro de los edificios:

---

Aplico las correcciones detectadas (curva que sigue el terreno, reruteo y aberturas):

---

Aplico las correcciones de trazado y de geometría:

---

El trazado ya no atraviesa muros. Ahora pruebo la interfaz completa:

---

Encontré el fallo: el reordenamiento dejó comas dobles (huecos en el array). Lo corrijo:

---

Últimos ajustes de calidad (minimapa, etiqueta del Generalife):

---

Optimizo el bucle (evito asignaciones por frame):

---

Listo. He creado **`alhambra-3d.html`** (70 KB, un solo fichero) en la carpeta actual.

**Qué contiene**

- **Modelo 3D procedural** del conjunto (Three.js desde CDN vía `importmap`): Alcazaba con la Torre de la Vela, Puerta de la Justicia, Palacio de Carlos V con su patio circular de 32 columnas, Palacios Nazaríes (Patio de los Arrayanes, Torre de Comares, Mexuar, Sala de los Abencerrajes, Patio de los Leones, Mirador de Lindaraja), Partal, Generalife con la Acequia, puente sobre el Darro y la Alameda. Todo con arcos de herradura extruidos, mocárabes, azulejos y tejas generados por código.
- **Recorrido de 1,7 km** con 15 paradas narradas (texto histórico + consejo de visita), trazado luminoso animado y viajero que recorre la ruta.
- **Controles**: reproduce/pausa, velocidad (0,5×–4×), 4 cámaras (Guía, Cinemática, Peatón, Libre), deslizador de **hora del día** (cielo, sol, sombras y farolas cambian), etiquetas 3D, narración por voz y **minimapa** en vivo con el plano.
- Interfaz responsive en español, con carga animada.

**Verificación realizada** (Chrome headless): sin errores de consola, los 15 elementos de la lista y todos los controles responden, el salto entre paradas funciona y — mediante trazado de rayos sobre la geometría — confirmé que el itinerario **no atraviesa muros ni superficies**, salvo los arcos que atraviesa intencionadamente (puerta de la Justicia, pórtico de Carlos V, galerías).

Ábrelo con doble clic (necesita conexión a Internet para cargar Three.js desde el CDN).
