# A3D · gpt-6.2-astra (default) · 5/10

**Maqueta limpia, la cámara no viaja**

## Nota del autor

**5/10**, nota definitiva de Daniel Primo. Se ve algo y ha intentado hacer algo bonito, pero no está el Patio de los Leones, la vista es extremadamente pequeña y no tiene una visita guiada interactiva de verdad.

La rúbrica le daba 6/10.

## Validación

- `validar.mjs`: sin errores de consola. `jugar-a3d.mjs '#next'`: capturas al cargar y tras cuatro «Siguiente parada».
- Un único fichero de 7,9 KB, sin librerías: el 3D (caras, orden de pintado y proyección) está programado a mano en canvas.

## Lo que está bien

- Ruta de cinco paradas reales en orden de visita: Alcazaba, Palacio de Carlos V, Palacios Nazaríes, El Partal y Generalife.
- La maqueta se gira arrastrando y tiene zoom. Se ven las torres almenadas de la Alcazaba y el patio circular de Carlos V.
- Vista limpia y textos correctos (la Torre de las Damas reflejada en la alberca, el patio circular dentro de una planta cuadrada).

## Lo que falta o está mal

- «Siguiente parada» cambia el texto y resalta la chincheta, pero la cámara no se mueve: la ruta no se recorre.
- Poco Alhambra a simple vista: las albercas de los Nazaríes apenas se distinguen y no hay Leones, arco de la Justicia ni Sierra Nevada.

## Rarezas de la sesión

- Cinco peticiones y cuatro llamadas. No lo abre en un navegador.
- Se programa su propio motor 3D en lugar de usar three.js.
