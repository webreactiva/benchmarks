Creando tu ruta 3D interactiva por la Alhambra — un solo archivo HTML con recorrido aéreo.

---

Generado **alhambra-ruta-3d.html** (853 líneas, 44KB) en la carpeta actual `/var/tmp/bench/ws-LaRo386L` — un solo fichero sin dependencias externas salvo CDN de Three.js.

**Contenido:**
- **Escena 3D completa** con terreno modelado de la colina de la Sabika, Sierra Nevada al fondo, valle del Darro y 7 edificios estilizados: Puerta de la Justicia, Alcazaba (Torre de la Vela y Homenaje), Palacio de Carlos V (patio circular), Patio de los Arrayanes con alberca reflectante, Patio de los Leones (124 columnas + 12 leones), Partal y Generalife.
- **Ruta guiada** con `CatmullRomCurve3` + `TubeGeometry` iluminada, partículas flotantes y marcadores interactivos. Cámara cinematográfica sigue la ruta con offset lateral.
- **7 paradas** con paneles informativos (historia, datos, cronología) y progreso sincronizado.
- **Controles:** `Iniciar/Pausar` (ESPACIO), Anterior/Siguiente (←→), velocidad regulable, minimapa 2D, leyenda y puntos clicables.
- **Modos:** `Ruta guiada` (tour automático), `Modo libre` (OrbitControls), `Vista aérea` cenital y `Día/Noche` con cambio de niebla, cielo procedural y luces puntuales.
- Diseño con tipografía Cinzel/Cormorant, paleta alhambreña (dorado, rojo nazarí, piedra) y estética arabesca.

Abre el archivo directamente en el navegador (doble clic) — no necesita servidor.
