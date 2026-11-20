# A3D · google/gemini-4-carbon · 9/10

**Se recorre y se reconoce.** Ocho paradas reales, ruta guiada que mueve la cámara y una maqueta con las piezas que hacen falta; en los Leones, los tejados tapan el patio.

> Segunda tirada: en la primera, la ruta por defecto de OpenRouter (Google Vertex) cortaba cada petición con «502 Network connection lost» a los ~5 min de razonar. Está en `_descartados/google_gemini-4-carbon-vertex-502/`.

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
- Carga sin errores de consola; un HTML de 75 KB con three.js 0.164.1 desde jsDelivr.
- Ocho paradas en un orden de visita creíble: Puerta de la Justicia, Alcazaba y Torre de la Vela, Carlos V, Arrayanes y Comares, Leones, Partal, Paseo de los Cipreses, Generalife.
- «Iniciar ruta guiada» hace avanzar un orbe por una curva luminosa y la cámara lo sigue; la ficha cambia sola al pasar por cada parada (`auto-desde-42.png`). Botones anterior/siguiente, píldoras y deslizador vuelan a cada parada.
- En el contenedor el render por software va a 1,3 fps y el avance usa el tiempo real con `dt ≤ 0,05`: por eso a los 30 s solo va por el 4 %. En un navegador normal el recorrido dura ~56 s, como dice el código.
- Vista aérea de día (`vista-aerea-dia.png`): murallas, palacios, Generalife con sus cipreses, el Albaicín enfrente.

## Lo que está bien
- Se reconoce sin etiquetas: arco de herradura de la Justicia, Carlos V cuadrado con el patio circular de columnas, alberca de Arrayanes con la torre de Comares, torres almenadas de la Alcazaba, cipreses del Generalife.
- Fichas con datos correctos: Yusuf I y 1348, Pedro Machuca, 124 columnas, Muhammad V, Torre de las Damas, la Acequia Real desde el Darro.
- Acabado cuidado: tres luces (atardecer, día, noche), distancia, altitud y tiempo acumulado por parada.

## Lo que falta o está mal
- En la parada de los Leones la cámara queda detrás de tejados y la fuente apenas asoma (`vista-parada-5.png`); en Arrayanes la torre de Comares tapa media pantalla.
- Sierra Nevada se menciona en las fichas pero no se ve en ninguna vista.
- Depende de un CDN: sin conexión no carga.

## Rarezas de la sesión
- Un solo `write` con el HTML entero y una comprobación de sintaxis con `node`: 4 peticiones, 111 000 tokens, 0,38 $.
- No lo abrió en un navegador; solo comprobó que el JavaScript parseaba.
