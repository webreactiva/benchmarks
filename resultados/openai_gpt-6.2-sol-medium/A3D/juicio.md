# A3D · gpt-6.2-sol (medium) · 10/10

**Maqueta clara y se recorre**

## Validación

- `validar.mjs`: sin errores de consola. `jugar-a3d.mjs '#next' '#start'`: capturas al cargar, tras cuatro «Siguiente» y a 10 y 30 s de «Iniciar ruta».
- Un único fichero, `alhambra.html`, de 790 KB: lleva dentro three.js y las fuentes.

## Lo que está bien

- Ruta de cinco paradas reales en un orden de visita creíble: Alcazaba, Palacio de Carlos V, Palacios Nazaríes, El Partal y Generalife.
- «Siguiente» y la lista lateral llevan la cámara de una parada a otra con un encuadre propio para cada una.
- Se reconoce sin leer: torres almenadas de la Alcazaba, el patio circular de Carlos V y el Patio de la Acequia del Generalife, sobre una colina con la forma de la Sabika.
- Vista limpia: la cámara no entra en los muros, las etiquetas se leen y la ruta discontinua no tapa los edificios.
- Los textos son correctos: Torre de la Vela, Mexuar, Comares y Leones, la Torre de las Damas con su alberca, el Patio de la Acequia.

## Lo que falta o está mal

- «Iniciar ruta» encuadra la primera parada y ahí se queda; para avanzar hay que pulsar «Siguiente». La rúbrica acepta el recorrido a mano.
- Es una maqueta esquemática (lo dice en la propia vista): no hay arco de la Justicia, Leones ni Sierra Nevada.

## Rarezas de la sesión

- Para probarlo usa el Playwright de otra instalación del equipo (dev-browser) y el Firefox del sistema, y deja una veintena de ficheros en `/tmp`. Es posible por la excepción de macOS: sin `encierro.sh`, el sandbox de Codex le deja leer el disco y escribir en `/tmp`.
- Lista `/tmp` y `/Applications` buscando navegadores. No entra en nada del benchmark.
- Descarga three.js y dos fuentes y los mete en el HTML.
- Mira sus propias capturas tres veces.
