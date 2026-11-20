# A3D · ollama/kimi-k3.1-pro · 10/10

**El mejor A3D, y sin librerías.** Una maqueta 3D con motor propio, sin three.js ni nada externo, que se reconoce (murallas almenadas, Alcazaba, Carlos V con su patio circular, los patios nazaríes con su fuente, el Generalife entre cipreses) y un recorrido de 6 paradas que lleva la cámara de una a otra sin atravesar nada. Diseño de guía turística: itinerario con tiempos, fichas, plano, atardecer, historia y consejos.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| ruta con paradas reales | 2 |
| la ruta se recorre | 3 |
| se reconoce la Alhambra | 2 |
| vista limpia | 1 |
| textos sin errores | 1 |
| **Total** | **10** |

## Validación
- Carga sin errores; un HTML de 67 KB sin ninguna dependencia: dibuja la maqueta con su propio motor sobre un canvas.
- Vista inicial (`capturas/inicio.png`): el recinto entero con la ruta discontinua y las 6 paradas numeradas.
- «Iniciar recorrido»: a los 10 s la cámara está sobre Carlos V (`auto-10s.png`) y a los 30 s sobre el Partal (`auto-30s.png`), con la ficha de cada parada y la barra de progreso.

## Lo que está bien
- Todo se ve limpio: la cámara encuadra cada parada desde arriba, sin meterse en muros.
- Textos correctos: la mano y la llave de la Puerta de la Justicia (1348), Pedro Machuca en Carlos V, el pórtico del Partal reflejado en el estanque.
- Guía completa: tiempos por parada (3 h 20 min, 3,2 km), plano, zoom, luz de atardecer, historia y «Antes de ir».

## Lo que falta
- Solo 6 paradas: los Palacios Nazaríes van en una.
- Sierra Nevada es un rótulo, no se ve.

## Rarezas de la sesión
- El único A3D sin librerías: ni three.js ni CDN, funciona sin conexión.
- Organizó el trabajo con una lista de tareas (todowrite) y lo probó en varias resoluciones.
- 23 peticiones y 1 millón de tokens.
