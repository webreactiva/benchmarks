# A3D · ollama/glm-5.3-flash · 9/10

**El mejor A3D: se recorre.** Es el único en que pulsas «Siguiente» o «Auto» y la cámara te lleva de verdad de un sitio a otro, y cada sitio se reconoce.

> Repetición con los límites reales del modelo. La primera prueba se cortó en el tope de 32 000 tokens de salida de OpenCode y está en `_descartados/`.

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
- Carga sin errores; un HTML de 24 KB, el más pequeño de los buenos.
- Cinco veces «Siguiente» llevan la cámara al Patio de los Leones (`capturas/parada-6.png`); en «Auto», a los 15 s está llegando al Generalife (`auto-15s.png`).

## Lo que está bien
- **Se reconoce la Alhambra**: muros rojizos almenados, el arco de herradura de la Puerta de la Justicia, el cilindro de Carlos V, los dos pabellones con tejado verde y las columnas del Patio de los Leones, el pórtico de arcos del Partal sobre su alberca, el Generalife con la acequia, cipreses y Sierra Nevada.
- 8 paradas en el orden de la visita, con un texto corto y correcto cada una («Erigida en 1348 bajo Yusuf I…»).
- Interfaz sobria: lista de paradas, ficha, anterior/siguiente, Auto y «Llegando a…».

## Lo que falta
- La fuente de los leones no está: el patio tiene pabellones y columnas, pero el centro vacío.
- Las etiquetas 3D de la vista general son diminutas.

## Rarezas de la sesión
- Su respuesta más larga fue de 38 666 tokens: con el tope antiguo, esta versión tampoco habría salido.
- Termina en inglés («Verification complete — the fix is confirmed»).
- Sacó el script del HTML a `/tmp/opencode/alh.mjs` para comprobar la sintaxis con `node --check`.
