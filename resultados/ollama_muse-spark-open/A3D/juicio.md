# A3D · ollama/muse-spark-open · 2/10

**Bonita por fuera; la cámara, perdida.** Interfaz muy cuidada (Cinzel, fichas con datos, progreso, minimapa, leyenda, día y noche) y 7 paradas con textos correctos, y el recorrido automático avanza. Pero la escena está tan a escala que la cámara va siempre pegada a los volúmenes, hasta en «vista aérea», y al saltar de parada con «Siguiente» la consola se llena de errores (unos 150, uno por fotograma).

## Nota del autor

**2/10**, nota definitiva de Daniel Primo. Es innavegable y no es para nada la Alhambra. El 3D es falso: los objetos no tienen volumen, no se puede navegar ni ver nada, y es imposible saber si está el Patio de los Leones.

La rúbrica le daba 7/10.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 0 |
| ruta con paradas reales | 2 |
| la ruta se recorre | 3 |
| se reconoce la Alhambra | 1 |
| vista limpia | 0 |
| textos sin errores | 1 |
| **Total** | **7** |

## Validación
- Carga sin errores; un HTML de 45 KB con three.js 0.160 desde jsDelivr y fuentes de Google.
- Recorrido automático desde el principio: parada 2 a los 45 s, sin errores.
- Cuatro veces «Siguiente»: llega a Leones, pero `CatmullRomCurve3.getPoint` falla en cada fotograma (`capturas/siguiente-x4.png`).
- Inicio, Leones y «vista aérea» (`inicio.png`, `auto-30s.png`, `aerea.png`): la cámara está dentro o pegada a muros y suelos; solo se distingue el anillo de Carlos V.

## Lo que está bien
- Fichas con texto correcto y datos (Puerta de la Justicia del siglo XIV, 124 columnas y 12 leones, la campana de la Vela para el riego).
- Minimapa, leyenda, velocidad, modo libre y noche.

## Lo que falla
- La cámara: nunca se ve el conjunto.
- Los errores al saltar de parada.

## Rarezas de la sesión
- 5 peticiones: lo escribió de una vez, sin probarlo.
- Promete «124 columnas + 12 leones» modelados; desde la cámara no se ven.
