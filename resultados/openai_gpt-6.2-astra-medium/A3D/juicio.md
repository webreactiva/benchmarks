# A3D · gpt-6.2-astra (medium) · 6/10

**Maqueta bonita, la cámara no viaja**

## Validación

- `validar.mjs`: sin errores de consola. `jugar-a3d.mjs '#next'`: capturas al cargar y tras cuatro «Siguiente parada».
- Un único fichero de 17 KB, sin librerías: el 3D está programado a mano en canvas.

## Lo que está bien

- Ruta de seis paradas reales en orden de visita: Alcazaba, Palacio de Carlos V, Palacios Nazaríes, El Partal, Paseo de las Torres y Generalife.
- La maqueta tiene más detalle que con el esfuerzo por defecto: colina, murallas con torres, bosque, la alberca del Partal y los huertos del Generalife. Se gira y tiene zoom.
- Textos correctos: la torre de la Vela, el patio circular en planta cuadrada, Mexuar, Comares y Leones, la torre de las Damas, el patio de la Acequia al otro lado de la vaguada.

## Lo que falta o está mal

- «Siguiente parada» cambia la parada activa y su texto, pero la cámara no se mueve: la ruta no se recorre.
- El patio circular de Carlos V no se distingue, y no hay Leones, arco de la Justicia ni Sierra Nevada.

## Rarezas de la sesión

- Tres llamadas y cuatro peticiones. No lo abre en un navegador.
- Se programa su propio motor 3D en lugar de usar three.js.
