# A3D · gpt-6-luna · 5/10

**Panel bonito, cámara quieta.** Una maqueta de cajas en canvas 2D con buena presentación, pero el recorrido no se mueve.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| ruta con paradas reales | 2 |
| la ruta se recorre | 0 |
| se reconoce la Alhambra | 1 |
| vista limpia | 0 |
| textos sin errores | 1 |
| **Total** | **5** |

## Validación
- `scripts/validar.mjs`: abre sin errores de consola, un canvas 2D.
- `juez/recorrido.mjs`: pulsa «Iniciar recorrido», espera 10 s y luego «Siguiente parada» dos veces. El lienzo es idéntico al inicial a los 10 s; en la parada 3 solo cambia el marcador resaltado (`capturas/juez-10s.png`, `capturas/juez-parada3.png`).
- El código lo confirma: los botones cambian el índice de la parada y la lista; la cámara solo responde al arrastre y a la rueda.

## Lo que está bien
- Cinco paradas reales en un orden de visita creíble: Puerta de la Justicia, Palacio de Carlos V, Patio de los Arrayanes, Palacio de los Leones y Generalife, con fichas correctas.
- Panel lateral cuidado, con duración, distancia y la cita de Icaza sobre Granada.

## Lo que falta o está mal
- La ruta no se recorre: ni en automático ni con «Siguiente parada» viaja la cámara.
- Poca Alhambra: un rectángulo de murallas con torres y cajas con ventanas, un estanque central y una franja clara que hace de sierra. No hay Carlos V circular, Leones, Comares ni acequia.
- A 1280 × 800 la cita del pie se monta sobre los botones, que quedan cortados por abajo.

## Rarezas de la sesión
- Lo hace en un solo paso: escribe los 9,6 KB del HTML de una vez y no lo abre ni lo prueba. 3 peticiones, 49 000 tokens, 3944 de salida.
- Dice en el chat que es una «escena 3D estilizada e interactiva»: es un canvas 2D con una proyección en perspectiva hecha a mano, sin WebGL ni three.js.
- Los subtítulos de las paradas no visitadas son de relleno: las dos primeras dicen «Alcazaba y palacios» y las otras tres «Recinto monumental».
