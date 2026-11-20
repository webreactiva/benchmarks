Voy a crear un único fichero HTML con una ruta 3D interactiva por la Alhambra de Granada (usando Three.js desde CDN), guardado en la carpeta actual.

---

La carpeta está vacía. Voy a crear el fichero HTML con la ruta 3D.

---

La carpeta está vacía. Voy a crear el fichero `alhambra-3d.html` con una escena 3D completa (Three.js): la colina de la Sabika, la muralla con almenas y torres, el Palacio Nazarí con sus patios, la Alcazaba con la Torre de la Vela, los jardines del Generalife, y una cámara que recorre una ruta animada por 8 puntos de interés con panel interactivo.

---

La carpeta está vacía. Voy a crear el fichero HTML con una escena 3D completa de la Alhambra (muros, Patio de los Leones con su fuente, Sala de las Dos Hermanas, Torre de Comares, jardines) y un recorrido guiado por 8 puntos de interés.

---

He cometido un error de sintaxis en el borrador. Voy a escribir el fichero completo y correcto de una vez:

---

He detectado un error en el material que acabo de escribir; voy a reescribir el fichero completo y correcto de principio a fin.

---

He detectado un par de detalles a corregir (un texto con errata y lógica de botones sobrante). Los corrijo:OK

---

Voy a verificar que el JavaScript no tenga errores de sintaxis:

---

Listo. He guardado la ruta 3D en la carpeta actual:

**📁 `/var/tmp/bench/ws-yfUufHj3/alhambra-ruta-3d.html`** (un único fichero, ~32 KB, sin dependencias locales)

### Qué incluye
- **Escena 3D completa de la Alhambra** con Three.js (desde CDN): recinto amurallado con almenas, la Alcazaba con sus torres, la Puerta de la Justicia, el Patio de los Arrayanes con su estanque y naranjos, el Palacio de Comares con la Torre de Comares, el **Patio de los Leones** (fuente con sus 12 leones y columnata perimetral), la Sala de las Dos Hermanas con cúpula de mocárabes, la Sala de los Abencerrajes, y los jardines del Generalife con su canal de agua, pérgolas y cipreses.
- **Texturas procedurales** (ladrillo, yesería geométrica nazarí, artesonado de ataurique, terreno) generadas en canvas: no requiere ningún archivo externo salvo la librería Three.js.
- **Ruta guiada automática** por 8 puntos de interés: la cámara vuela suavemente de uno a otro mostrando una tarjeta informativa con la historia de cada lugar.
- **Interactividad**: clic en las esferas doradas pulsantes (o en la lista lateral) para volar a un punto concreto; modo vuelo libre con órbita/zoom; botones de iniciar/pausar/reiniciar, selector de velocidad (1×–4×) y atajo de teclado (ESPACIO).

Para usarlo, basta con abrir el fichero en cualquier navegador moderno con conexión a internet (para cargar Three.js desde el CDN).
