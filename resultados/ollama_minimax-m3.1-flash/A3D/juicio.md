# A3D · ollama/minimax-m3.1-flash · 4/10

**Mucho detalle; textos inventados.** El A3D más grande: 16 paradas, cámara sobre una curva que recorre el recinto, Carlos V con su patio circular, murallas, jardines, Sierra Nevada, minimapa, cuatro luces y three.js incrustado para funcionar sin conexión. Pero los paneles tapan media escena, las etiquetas se pisan y las fichas tienen datos inventados: una figura de «El Descubridor» que «señala La Meca» sobre la Puerta de la Justicia, Carlos V «erigido entre 1527 y 1537», Santa María como «la referencia más reconocible».

## Nota del autor

**4/10**, nota definitiva de Daniel Primo. Se queda en un 4.

La rúbrica le daba 8/10.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| ruta con paradas reales | 2 |
| la ruta se recorre | 3 |
| se reconoce la Alhambra | 2 |
| vista limpia | 0 |
| textos sin errores | 0 |
| **Total** | **8** |

## Validación
- Carga sin errores; un HTML de 751 KB con three.js dentro (funciona sin conexión).
- El recorrido arranca solo y avanza despacio: a los 45 s va por la parada 2 de 16 (`capturas/auto-45s.png`).
- Con «siguiente» cuatro veces llega a la parada 5, Carlos V, pero la cámara encuadra una torre con la etiqueta de Santa María (`siguiente-x4.png`).

## Lo que está bien
- 16 paradas en un orden de visita completo, de la Puerta de la Justicia al Mirador de Lindaraja.
- Minimapa con la ruta y el cono de visión, línea de tiempo, velocidad, amanecer, mediodía, atardecer y noche, vista libre y atajos.

## Lo que falla
- Los textos: la Puerta de la Justicia no tiene ninguna figura de un peregrino que señale La Meca ni abrió al público en 1858; Carlos V se empezó en 1527 y no se terminó hasta el siglo XX; Santa María no es lo más reconocible de la Alhambra.
- Los paneles laterales tapan buena parte de la escena y las etiquetas 3D se montan unas sobre otras.

## Rarezas de la sesión
- 90 peticiones y 8,8 millones de tokens.
- Montó un proyecto: módulos JS en src/, plantilla, CSS y un build.py que lo junta todo, con three.min.js descargado e incrustado. Entregó también las fuentes.
- Asegura que «la cámara nunca queda dentro de un muro» y que lo verificó en Chromium.
