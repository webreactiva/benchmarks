He creado la ruta interactiva en 3D por la Alhambra de Granada en un único fichero HTML: **`alhambra-3d.html`** (guardado en la carpeta actual).

### Qué incluye la ruta 3D (`alhambra-3d.html`)
Un recorrido continuo en 3D sobre la colina de la Sabika y el Cerro del Sol, con Sierra Nevada nevada en el horizonte, texturas generadas proceduralmente en `<canvas>` (tapial rojo, alicatado nazarí, yesería *sebka*, mármol de Macael, teja árabe y empedrado granadino) y agua animada:

1. **Puerta de la Justicia y Murallas Rojas** — Arco de herradura monumental, paño cerámico, almenas y paseo de cipreses.
2. **Alcazaba y Torre de la Vela** — Plaza de Armas, restos del barrio castrense, torres vigía y la espadaña con campana.
3. **Palacio de Carlos V** — Fachada renacentista cuadrada y acceso al **patio circular** de doble columnata dórica y jónica.
4. **Patio de los Arrayanes y Torre de Comares** — Gran alberca reflejante flanqueada por setos de mirto y pórticos nazaríes de 7 arcos.
5. **Patio y Fuente de los Leones** — Galerías de columnas esbeltas, templetes con cubierta piramidal, los 12 leones con surtidores animados y las cuatro acequias.
6. **Jardines del Partal y Torre de las Damas** — Pórtico de cinco arcos reflejado en su estanque entre terrazas, rosales y naranjos.
7. **Generalife y Patio de la Acequia** — Acceso por el Paseo de los Cipreses hasta el canal central con surtidores parabólicos cruzados y pabellones blancos.

### Controles y funciones
- **Modos de cámara**: **Ruta Guiada** (recorrido automático por trazado 3D con pausa, velocidad y salto por parada), **Explorar** (órbita libre con ratón y rueda), **Paseo Libre** (`WASD` / flechas + ratón + `Shift`) y **Panorámica** (vista aérea de todo el conjunto).
- **Iluminación dinámica**: cambia al instante entre **Atardecer**, **Día** y **Noche** (con estrellas, luna y faroles nazaríes encendidos).
- **Interfaz interactiva**: fichas históricas de cada parada, balizas 3D clicables, minimapa 2D en tiempo real y botón **♪ Agua** para activar sonido ambiental de fuentes sintetizado con Web Audio API.
- **Cómo abrirlo**: ábrelo directamente en cualquier navegador moderno con conexión a internet (para cargar Three.js desde CDN).
