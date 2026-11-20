Estoy depurando el render (la escena sale negra en la captura de prueba); capturo los errores de consola.

---

Ajustando encuadres de algunas paradas (Leones, Partal) y suavizando los surtidores; luego reviso las paradas 2 y 4.

---

He creado la ruta en un solo fichero: **`/var/tmp/bench/ws-f1Xgr8nd/alhambra-ruta-3d.html`**. Se abre directamente en el navegador, pero necesita conexión a Internet porque carga Three.js desde un CDN.

Es un recorrido en 3D a vista de dron, a media tarde, por una Alhambra estilizada sobre la colina de la Sabika. Al fondo se ven el Albaicín, Granada y Sierra Nevada nevada.

**Las 8 paradas** (cada una con una ficha de texto y un dato histórico):
1. **Mirador de San Nicolás:** la vista clásica desde el Albaicín.
2. **Alcazaba y Torre de la Vela:** con la campana, la bandera ondeando y los cimientos del barrio castrense.
3. **Palacio de Carlos V:** la planta cuadrada con su patio circular de dos pisos de columnas.
4. **Patio de los Arrayanes:** la alberca refleja de verdad el pórtico y la Torre de Comares.
5. **Patio de los Leones:** galerías de columnas, los dos templetes, la fuente de los 12 leones con surtidores animados y los cuatro canales.
6. **Jardines del Partal:** el pórtico y la Torre de las Damas reflejados en la alberca.
7. **Generalife, Patio de la Acequia:** con los arcos de agua animados y los parterres de flores. Se llega por el Paseo de los Cipreses.
8. **Vista final** de toda la colina al atardecer.

**Controles:**
- **Reproducir/pausa:** botón o barra espaciadora.
- **Cambiar de parada:** botones, flechas ← → o la lista de la izquierda.
- **Velocidad:** de 0,5× a 3×.
- **Vista libre:** botón o tecla F; arrastras para girar y usas la rueda para acercar.
- **Plano:** un minimapa muestra la ruta y tu posición, y unas etiquetas flotantes nombran los monumentos.
- **Enlace directo:** puedes abrir una parada concreta, por ejemplo con `#parada=5`.

He comprobado el resultado en Chrome sin interfaz, con capturas de las ocho paradas. Al revisarlas corregí una escena que salía en negro y reencuadré la cámara en Arrayanes, Leones y el Partal. Las capturas son fotogramas fijos: no he visto la animación en movimiento en un navegador normal. Tampoco he probado la vista libre ni el diseño para pantallas pequeñas.

Los edificios son una interpretación simplificada, no una maqueta a escala: las proporciones y las posiciones son aproximadas.

Si quieres, también puedo publicarlo como página web para compartirlo con un enlace.
