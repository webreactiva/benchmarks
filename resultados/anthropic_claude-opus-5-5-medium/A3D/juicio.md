# A3D · claude-opus-5-5 (medium, Claude Code) · 9/10

**La maqueta más vistosa, con la ficha encima.** Una Alhambra con three.js a media tarde que se reconoce de un vistazo (Sierra Nevada nevada, Alcazaba con la Torre de la Vela, patio circular de Carlos V, alberca de Arrayanes con su pórtico, Leones con galerías y templetes, Partal, acequia del Generalife con arcos de agua) y un recorrido de 8 paradas que arranca solo y lleva la cámara en vuelo de una a otra. Pero a 1280×800 la ficha de la parada tapa el final de la lista (la parada 8 no se puede pulsar) y un cuarto de la escena, y en la vista final las etiquetas se montan.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| ruta con paradas reales | 2 |
| la ruta se recorre | 3 |
| se reconoce la Alhambra | 2 |
| vista limpia | 0 |
| textos sin errores | 1 |
| **Total** | **9** |

## Validación
- Carga sin errores de consola. three.js r128 desde cdnjs, OrbitControls y Reflector desde jsDelivr, fuentes de Google; 59 KB.
- El recorrido arranca solo al cargar (`capturas/tour-10s.png`). Con «siguiente» y velocidad 3× la cámara sale volando de San Nicolás hacia la Alcazaba (`viaje-30s.png`, `viaje-90s.png`). En este Chromium sin GPU va a 1 fotograma/s y la página limita el paso de tiempo por fotograma, así que los 10 s de cada parada duran casi tres minutos: en un navegador normal va fluido.
- Saltar desde la lista lleva a cada parada con un fundido (`parada-4.png`, `parada-5.png`); la vista libre gira con el ratón (`vista-libre.png`).
- La parada 8 de la lista no se puede pulsar: Playwright informa de que la ficha (`#card`) intercepta el clic (`juez/tour.cjs`).

## Lo que está bien
- Se reconoce sin etiquetas: Sierra Nevada con nieve, murallas rojas sobre la Sabika con el Albaicín enfrente, Torre de la Vela con su campana, Carlos V cuadrado con el patio circular, la alberca de Arrayanes reflejando el pórtico y Comares, la fuente de Leones con sus canales y los templetes, el pórtico del Partal sobre su alberca, la acequia del Generalife entre flores y cipreses.
- Cámara de dron que no se mete en los muros y encuadra cada parada.
- Textos correctos y con datos que se sostienen: Torre de la Vela de unos 27 m y el 2 de enero de 1492, Carlos V de 63 m de lado cubierto en el siglo XX, alberca de 34 m, Partal de época de Muhammad III, la etimología discutida del Generalife.
- Minimapa con la ruta y la posición, velocidad, vista libre, teclado y enlace directo a una parada (`#parada=5`).

## Lo que falta o está mal
- **La ficha tapa la lista**: a 1280×800 cubre la última parada, que no se puede pulsar, y ocupa el cuarto inferior izquierdo de la escena en todas las paradas.
- Etiquetas encimadas en la vista final y en la libre («Palacio de Carlos V · Alcazaba», «Patio de los L… Torre de las Damas»); la de la Torre de la Vela flota muy por encima de la torre.
- La primera parada, el Mirador de San Nicolás, está fuera del recinto: es una vista, no una parada de la visita.

## Rarezas de la sesión
- Se comprobó a sí mismo con Chrome headless (SwiftShader): la primera captura salió negra, inyectó un registro de errores en una copia del HTML, encontró que el mapa de entorno (PMREM) rompía el render y lo quitó; luego miró capturas de las ocho paradas y reencuadró Arrayanes, Leones y el Partal.
- Cuenta con precisión lo que no probó: «Las capturas son fotogramas fijos: no he visto la animación en movimiento… Tampoco he probado la vista libre ni el diseño para pantallas pequeñas». El fallo de la ficha sobre la lista está justo ahí.
- 2,28 M tokens en 17 peticiones (93 k de salida, 2,07 M leídos de caché); algo menos que Sonnet.
- Termina ofreciendo publicarlo como página web con un enlace.
- Corrió sin encierro; no leyó nada fuera de su carpeta de trabajo y su scratchpad (`scripts/fugas.py` limpio).
