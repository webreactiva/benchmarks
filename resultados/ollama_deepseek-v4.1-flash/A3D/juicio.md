# A3D · ollama/deepseek-v4.1-flash · 6/10

**La mejor maqueta, el tour falla.** Lo primero que ves es la Alhambra reconocible; lo que pasa al pulsar «Iniciar recorrido», no.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| ruta con paradas reales | 2 |
| la ruta se recorre | 0 |
| se reconoce la Alhambra | 2 |
| vista limpia | 0 |
| textos sin errores | 1 |
| **Total** | **6** |

## Validación
- Carga sin errores de consola (41 KB, three.js desde jsDelivr).
- Vista general (`capturas/inicio.png`): colina amurallada, Alcazaba con torres, Palacio de Carlos V con el patio circular, Generalife con jardines y la acequia, casas alrededor, Sierra Nevada nevada.
- Tour (`tour-10s.png`, `tour-35s.png`): la cámara baja a la Puerta de la Justicia y se queda dentro de la muralla; a los 35 s sigue en «Parada 1 de 5».

## Lo que está bien
- Es la única escena del benchmark que se reconoce como la Alhambra sin leer las etiquetas: el patio circular de Carlos V y el Generalife con su acequia.
- Interfaz cuidada en español: lista de paradas, ficha de cada una, vista general, reiniciar, velocidad.

## Lo que falla
- **El recorrido no se ve**: la cámara atraviesa la muralla en la primera parada y no avanza en el tiempo de la prueba.
- Solo 5 paradas, con los Palacios Nazaríes en una sola (sin Arrayanes, Leones, Embajadores).

## Rarezas de la sesión
- 33 peticiones y 2,2 millones de tokens, el mayor gasto del benchmark.
- **Se montó su propio navegador de pruebas**: un cliente de Chrome DevTools Protocol escrito a mano por WebSocket, capturas con Chrome headless, y como no veía las imágenes, las analizó leyendo píxeles con PIL. Después, 12 ediciones.
- Dejó ficheros de prueba fuera de su carpeta, en `/tmp`.
