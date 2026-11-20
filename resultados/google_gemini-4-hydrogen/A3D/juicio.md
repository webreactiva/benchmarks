# A3D · google/gemini-4-hydrogen · 9/10

**A pie de calle, tapado.** Una ruta guiada que se recorre y una Alhambra que se reconoce de cerca, con marcadores enormes en medio de la vista.

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
- Carga sin errores; 98 KB con three.js r128 desde cdnjs.
- Ocho paradas en orden de visita: Puerta de la Justicia, Alcazaba, Carlos V, Arrayanes, Salón de Embajadores, Leones, Partal, Generalife.
- La ruta guiada arranca sola y la cámara sigue la curva a pie de calle. Desde la parada 4 avanza hacia la 5 (47,7 % a los 30 s, con el render por software a 1,7 fps; en un navegador normal va unas 15 veces más rápido). La barra inferior y el minimapa saltan a cada parada (`juez/recorrido.mjs`).
- Tres modos: ruta guiada, órbita y a pie con WASD. Cuatro luces.

## Lo que está bien
- Se reconoce de cerca: arco de herradura de la Justicia, patio circular de dos pisos de Carlos V, alberca de Arrayanes con sus pórticos, la fuente con los leones, el Patio de la Acequia con surtidores.
- Fichas correctas y con datos: Yusuf I, Pedro Machuca, la cúpula de los siete cielos, 124 columnas, Torre de las Damas, la Acequia Real.

## Lo que falta o está mal
- Un marcador con el número de la parada, del tamaño de media pantalla, flota delante de cada vista (`parada-5.png`, `parada-7.png`).
- En el Salón de Embajadores la cámara queda contra un muro y casi no se ve la sala.
- Depende de un CDN.

## Rarezas de la sesión
- Lo probó en Chrome con Playwright: abrió la página, saltó a las paradas 4 y 6 y comprobó los títulos.
- Comprobó con `curl` que el CDN de three.js respondía antes de usarlo.
- 7 peticiones, 220 000 tokens, 0,43 $.
