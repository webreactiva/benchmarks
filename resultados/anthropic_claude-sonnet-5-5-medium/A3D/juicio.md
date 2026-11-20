# A3D · claude-sonnet-5-5 (medium, Claude Code) · 9/10

**Se pasea por dentro, con encuadres flojos.** Una maqueta con three.js que se recorre a pie a la altura de los ojos por 9 paradas en orden de visita, y se reconoce: Puerta de la Justicia con la llave, Alcazaba, patio circular de Carlos V, fuente de los doce leones con sus canales, Comares y la acequia del Generalife con surtidores. Pero en la vista Paseo, que es la del recorrido, varias paradas encuadran un muro: el Mexuar es un panel de azulejos a un palmo, en Arrayanes no se ve el estanque y el mirador final mira a una muralla.

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
- Carga sin errores de consola. three.js r128 desde cdnjs; 55 KB.
- «Comenzar la ruta» lleva la cámara a pie por la ruta y para 8 s en cada parada con su ficha (`capturas/tour-10s.png`, `tour-60s.png`). En este Chromium sin GPU va a unos 2 fotogramas/s y la página limita el paso de tiempo por fotograma, así que avanza más despacio que en un navegador normal.
- Saltar a una parada desde la lista mueve la cámara allí (`parada-3.png`, `parada-4.png`, `parada-5.png`, `parada-6.png`, `parada-9.png`); la vista Dron sigue la misma ruta desde arriba (`dron.png`).
- Barrido del deslizador de progreso en vista Paseo (`juez/barrido.cjs`): la cámara cruza las murallas por las puertas, no a través de ellas.

## Lo que está bien
- Se reconoce sin etiquetas: arco de la Justicia con la llave, torres almenadas de la Alcazaba, patio circular de dos pisos de Carlos V, la fuente con los doce leones y los cuatro canales, la Torre de Comares sobre las arquerías, la acequia del Generalife entre parterres y chorros.
- Ruta creíble: Justicia, Alcazaba, Carlos V, Mexuar, Arrayanes, Leones, Partal, Generalife y mirador.
- Tres vistas (Paseo, Dron, Libre), tres luces, velocidad, deslizador de progreso, minimapa con la posición y atajos de teclado.
- Textos correctos: la mano y la llave de la Justicia (Yusuf I, 1348), Pedro Machuca y las 32 columnas de Carlos V, las 124 columnas de Leones.

## Lo que falta o está mal
- **Encuadres a pie**: en el Mexuar la cámara mira un panel de azulejos a un palmo, en Arrayanes mira hacia arriba a la torre y el estanque queda fuera, y el «Mirador sobre la Alhambra» mira a un tramo de muralla.
- La ficha en ruta dice «Hacia:» la parada más cercana, no la siguiente: al salir de la Justicia pone «Hacia: Puerta de la Justicia».
- Sierra Nevada son conos verdes sin nieve en la vista general.
- ~ «Dentro de la torre se halla el Salón del Trono, o Sala de Embajadores, de 45 m de altura total»: los 45 m son de la torre, no de la sala; la frase se presta a leerlo mal.

## Rarezas de la sesión
- Se comprobó a sí mismo: descargó three.js a su scratchpad para probar sin red, sacó capturas con Chrome headless (SwiftShader) inyectando JavaScript en copias del HTML y leyó 15 capturas; corrigió la cornisa de Carlos V que tapaba el patio, el arbolado y la cámara de la primera parada.
- Dejó en el HTML final el gancho de pruebas que se fabricó para esas capturas (`window.__alhambra` con `setMode`, `gotoStop` y la órbita).
- 2,66 M tokens en 19 peticiones (102 k de salida, 2,43 M leídos de caché): casi el triple que Haiku en este prompt (981 k en 11).
- Corrió sin encierro; no leyó nada fuera de su carpeta de trabajo y su scratchpad (`scripts/fugas.py` limpio).
