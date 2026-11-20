Voy a crear un único `alhambra_ruta_3d.html` con Three.js: maqueta 3D, ruta guiada con paradas, modo paseo, dron y libre, y minimapa.

---

Funciona y renderiza. Ahora verifico visualmente la maqueta y la ruta desde varios puntos, y ajusto lo que se vea mal, empezando por el arbolado, que tapa demasiado.

---

Buen resultado general. Detecto un fallo: la cornisa de Carlos V es una losa maciza que tapa el patio circular. La corrijo, alejo la cámara de la primera parada y reviso las demás paradas.

---

He creado `alhambra_ruta_3d.html` en la carpeta actual. Es un único fichero de unos 55 KB que se abre con doble clic. Necesita conexión a internet, porque carga Three.js desde cdnjs.

Lo he comprobado con Chrome headless: se ve la maqueta, la ruta y las paradas, y no hay errores de JavaScript en consola. No lo he probado en un navegador con GPU real ni en el móvil.

**La maqueta** es estilizada y no está a escala. Incluye:
- las murallas con torres y almenas;
- la Puerta de la Justicia y la Alcazaba con la Torre de la Vela;
- el Palacio de Carlos V con su patio circular de 32 columnas;
- el Mexuar;
- el Patio de los Arrayanes con la Torre de Comares;
- el Patio de los Leones con la fuente de los 12 leones;
- el Partal con la Torre de las Damas;
- los jardines del Generalife, con su acequia y sus chorros de agua animados;
- el entorno: bosque, Albaicín, Granada y Sierra Nevada.

**La ruta** son 9 paradas. Empieza en la Cuesta de Gómerez y la Puerta de la Justicia, atraviesa la Alcazaba, Carlos V y los Palacios Nazaríes, y termina en el Generalife con un mirador hacia la Alhambra. En cada parada la cámara se detiene y se abre una ficha con un texto en español.

**Controles:**
- Hay tres vistas: **Paseo** (a pie por la ruta), **Dron** (vuelo siguiendo la ruta) y **Libre** (órbita alrededor de la maqueta).
- Puedes reproducir o pausar, saltar de parada y cambiar la velocidad entre 0.6× y 4×. También hay un deslizador de progreso y un minimapa.
- La luz tiene tres opciones: mañana, día y ocaso.
- Con el ratón arrastras para mirar y usas la rueda para acercar. El teclado usa espacio (pausa), ← → (paradas) y 1/2/3 (vistas).

La Puerta de la Justicia y las tres paradas del recorrido por los palacios (Mexuar, Arrayanes y Leones) quedan algo simplificadas, y la geometría de los edificios es aproximada.
