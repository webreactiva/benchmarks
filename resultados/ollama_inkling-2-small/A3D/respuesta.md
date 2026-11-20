I left a broken placeholder line in the Generalife section — fixing it:

---

Now fixing overlap issues between the Comares tower and the Arrayanes gallery/pool:

---

Now let me syntax-check the embedded JS:

---

No JS errors. Applying fog/light refinements:

---

Listo. He creado `alhambra-3d.html` (fichero único, ~43 KB) con el recorrido 3D completo. Requiere conexión a Internet solo para cargar Three.js desde CDN; si no hay WebGL, muestra un aviso.

**Qué incluye**

- **Recorrido guiado en 9 paradas**: Panorámica → Puerta de la Justicia → la Alcazaba (Torre de la Vela e Homenaje) → El Mexuar → Patio de los Arrayanes → Patio de los Leones (con los 12 leones y surtidor) → El Partal → El Generalife → Mirador del Albaicín. Con botones ‹ ›, recorrido automático con pausa, puntos de progreso, índice lateral, flechas de teclado y parámetro `?p=N` para enlazar a una parada concreta.
- **Escena 3D completa**: muralla con torres, cerro de la Sabika, Vega, río Darro y puente, caserío del Albaicín/Granada, Sierra Nevada con cumbres nevadas, cielo con sol y nubes a la deriva, cipreses, naranjos y acequias con chorros animados.
- **Vista libre**: botón «Vista libre» para orbitar con arrastre y zoom con rueda/pellizco; brújula en vivo y etiquetas clicables sobre cada monumento.

Verificado con Chrome headless: renderiza sin errores JS en varias paradas. Para abrirlo: `google-chrome alhambra-3d.html` o simplemente doble clic en el fichero.
