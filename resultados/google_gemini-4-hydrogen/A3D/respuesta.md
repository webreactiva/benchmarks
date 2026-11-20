He generado la ruta interactiva en 3D por la Alhambra de Granada en un único fichero HTML guardado en la carpeta actual:

- **`alhambra-ruta-3d.html`**

### Qué incluye
- **Escenario 3D en Three.js con texturas procedurales**: colina de la Sabika, murallas de tapia roja, bosque de la Alhambra, silueta de Sierra Nevada al fondo y detalles arquitectónicos generados en el propio documento (arcos de herradura y nazaríes, yeserías, azulejos, mármol, cúpula estrellada y agua animada).
- **8 paradas monumentales conectadas por una ruta 3D**:
  1. **Puerta de la Justicia** (arco de herradura y relieves de la mano y la llave)
  2. **Alcazaba y Plaza de los Aljibes** (Torre de la Vela, Torre del Homenaje y Patio de Armas)
  3. **Palacio de Carlos V** (patio circular porticado de dos pisos)
  4. **Patio de los Arrayanes** (alberca reflectante, setos y Torre de Comares)
  5. **Salón de Embajadores** (interior con zócalos de azulejos y cúpula de los siete cielos)
  6. **Patio de los Leones** (galerías de mármol, templetes, cuatro canales y la Fuente de los Leones)
  7. **Jardines del Partal** (alberca, Torre de las Damas, cipreses y naranjos)
  8. **El Generalife** (Paseo de los Cipreses y Patio de la Acequia con surtidores de agua animados)
- **3 modos de navegación**:
  - **Ruta Guiada**: recorrido suave automático por la curva de la ruta (pausable con `Espacio` o el botón central).
  - **Explorar (Órbita)**: rotación libre y zoom alrededor de cada monumento.
  - **A Pie**: desplazamiento en primera persona con `W A S D` o flechas (y controles táctiles en pantalla).
- **Iluminación dinámica y utilidades**: selector de momento del día (*Amanecer*, *Día*, *Atardecer*, *Noche* con faroles encendidos), minimapa 2D interactivo con vista de cámara, marcadores 3D clicables, atajos numéricos `1–8`, tecla `H` para ocultar/mostrar la interfaz y sonido ambiental opcional de agua generado con Web Audio API.

### Verificación
- Probado en Google Chrome headless (`file:///var/tmp/bench/ws-AiHlfEFW/alhambra-ruta-3d.html`) comprobando el renderizado WebGL, el cambio entre paradas, modos e iluminación sin errores en consola ni excepciones.

Puedes abrir `alhambra-ruta-3d.html` directamente en cualquier navegador moderno (solo requiere acceso a internet la primera vez para cargar Three.js desde CDN).
