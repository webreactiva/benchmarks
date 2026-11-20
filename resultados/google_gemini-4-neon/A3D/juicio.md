# A3D · google/gemini-4-neon · 9/10

**Se recorre y se reconoce.** Siete paradas a pie de calle que la cámara recorre sola; los chorros del Generalife tapan la última vista.

> Tercera tirada. En las dos primeras, Neon pensaba más de 6 minutos antes de escribir el HTML y la conexión se cortaba («Network connection lost»): primero por el nivel «flex» de AI Studio y después también por el estándar. Están en `_descartados/google_gemini-4-neon-flex/`. Esta fue por AI Studio estándar con `SALIDA_MAX=65536`: también tuvo cortes, pero los reintentos salieron y la sesión terminó.

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
- Carga sin errores; 103 KB con three.js 0.160 desde jsDelivr.
- Siete paradas en orden de visita: Puerta de la Justicia, Alcazaba, Carlos V, Arrayanes, Leones, Partal, Generalife.
- La ruta guiada arranca sola: Alcazaba a los 60 s y Carlos V a los 120 s, con el render por software a 2 fps (`juez/recorrido.mjs`). La barra de paradas y el minimapa saltan a cada una.
- Modos: ruta guiada, órbita, paseo libre con WASD y panorámica; tres luces y sonido de agua.

## Lo que está bien
- Se reconoce de cerca: el patio circular de dos pisos de Carlos V, el pórtico de Arrayanes con la torre de Comares detrás, el templete del Patio de los Leones, la Torre de la Vela, el Patio de la Acequia.
- Fichas correctas: Yusuf I, Pedro Machuca, el pórtico de siete arcos, Muhammad III en el Partal, la campana de la Vela y los turnos de riego.

## Lo que falta o está mal
- En el Generalife los chorros de agua se dibujan como cuadrados blancos enormes que tapan media vista (`parada-8.png`).
- En los Leones la cámara enseña el templete, pero no la fuente.
- Depende de un CDN.

## Rarezas de la sesión
- Escribió los 103 KB de una vez y revisó el JavaScript con `node` varias veces; no lo abrió en un navegador.
- 19 peticiones, 1 millón de tokens (860 000 de caché), 1,28 $.
