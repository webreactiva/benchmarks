I'll create an interactive 3D route through the Alhambra in Granada. Let me first check the environment.

---

Voy a comprobar si puedo incrustar Three.js en el propio fichero para que sea 100% autónomo.

---

Three.js UMD (r160) disponible — lo incrustaré para que el HTML sea autónomo. Verifico algunos símbolos del build:

---

Ahora escribo el motor. Parte 1 — núcleo, texturas, cielo, iluminación y controles:

---

Parte 2 — terreno (cerro de la Sabika), río Darro, Albaicín y Sierra Nevada:

---

Parte 3 — el modelo arquitectónico (Alcazaba, Palacios Nazaríes, Carlos V, Generalife):

---

Parte 3b — jardines, cipreses y parterres:

---

Parte 4 — el recorrido, la cámara y las etiquetas 3D:

---

Detecté texto corrupto en las descripciones; reescribo la parte del recorrido con texto limpio:

---

Corrijo los bugs detectados (ventanas, arquería, puerta de la Justicia):

---

Parte 5 — interfaz (HUD, lista de paradas, línea de tiempo, minimapa):

---

Parte 6 — bucle de animación e inicialización:

---

No puedo ver imágenes, así que validaré con muestreo de píxeles y diagnósticos del renderer:

---

Ajusto la iluminación (el atardecer quedaba demasiado oscuro) y pruebo el funcionamiento:

---

Verifico la planta del conjunto con una vista cenital:

---

El fallo era de mi propio script de prueba (un bloque de depuración antiguo). Lo limpio y repito:

---

Corrijo solapamientos del HUD en pantallas medianas:

---

Hago visibles los interiores de las dos salas mayores (antes eran volúmenes macizos):

---

Listo. **`alhambra-3d.html`** (751 KB, en la carpeta actual) es un único fichero autónomo: se abre con doble clic y funciona sin conexión (Three.js va incrustado dentro).

**Qué contiene**
- **Recorrido guiado de 16 paradas** con cámara sobre spline: Puerta de la Justicia → Plaza de los Aljibes → Alcazaba y Torre de la Vela → Torre Quebrada → Palacio de Carlos V → Patio de los Leones → Sala de los Abencerrajes → Sala de los Embajadores → Patio de los Arrayanes → Mexuar → Torre de Comares y su mirador → Acequia, Escalera de Agua y palacio del Generalife → Mirador de Lindaraja. Cada parada lleva ficha histórica en español.
- **Modelo 3D procedural** del recinto amurallado (900×400 m a escala real): muralla de tapial con almenas, Alcazaba (Vela, Homenaje, Quebrada, Damas), Palacios Nazaríes con arcos herradura y mocárabes, fuente de los doce leones, pila de los Arrayanes, cúpula de los Embajadores, Palacio de Carlos V con patio circular, Santa María, Generalife con acequia y surtidores; además cerro de la Sabika, río Darro, Albaicín y Sierra Nevada de fondo.
- **Interfaz**: lista de paradas, línea de tiempo navegable, minimapa con la ruta y cono de visión, etiquetas 3D sobre los monumentos, control de velocidad, cuatro presets de luz (amanecer, mediodía, atardecer, noche) y vista libre con arrastre/rueda.
- Atajos: espacio (reproducir), ←/→ (paradas), L (vista libre), H (ayuda).

**Verificación**: probado en Chromium sin errores de consola; 1 sola petición de red (el propio fichero), sin solapamientos del HUD entre 820 y 1440 px, y la cámara nunca queda bajo el terreno ni dentro de un muro.

Dejo también `src/` (CSS, plantilla y JS por módulos) y `build.py`, que regenera el HTML final con `python3 build.py` por si quieres seguir ampliándolo.
