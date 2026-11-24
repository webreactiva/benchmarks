# A3D · claude-haiku-5-5 (Claude Code) · 3/10

**Funciona, pero la ruta tapa la Alhambra.** La escena tiene más contexto que la de nemotron, pero lo que más se ve durante el tour es el tubo amarillo que marca el camino.

## Nota del autor

**3/10**, nota definitiva de Daniel Primo. Es innavegable y lo que muestra no tiene sentido.

La rúbrica le daba 8/10.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| ruta con paradas reales | 2 |
| la ruta se recorre | 3 |
| se reconoce la Alhambra | 1 |
| vista limpia | 0 |
| textos sin errores | 1 |
| **Total** | **8** |

## Validación
- Carga sin errores de consola. three.js 0.160 desde jsDelivr con `importmap`.
- Reproducir, anterior/siguiente, flechas y espacio, selector de velocidad y modo libre funcionan (`capturas/tour-10s.png`, `parada-6.png`).

## Lo que está bien
- Paisaje: cielo, Sierra Nevada con nieve al fondo, colina, torres con tejado, cipreses y setos en el Generalife.
- 10 paradas con textos correctos y bien escritos (la cúpula de muqárnas de los Abencerrajes, la explanada del Patio de Armas).
- Interfaz completa en español: lista de paradas, ficha de cada una, barra de progreso, «Parada 7 de 10».
- Avisa en pantalla de que es una maqueta esquemática con posiciones aproximadas.

## Lo que falla
- **El tubo de la ruta y la esfera del marcador ocupan media pantalla** durante el tour: la cámara va pegada a ellos.
- Los edificios siguen siendo bloques: no hay patio con estanque, ni leones, ni arcos.
- El orden real de la visita lo respeta a medias: Torre de las Damas (Partal) va después de los Abencerrajes; bien. El Patio de Armas, que está dentro de la Alcazaba, va antes que Carlos V; aceptable.
- Etiquetas encimadas en la vista general.

## Rarezas de la sesión
- **Se revisó a sí mismo**: hizo tres capturas con Chrome headless, las leyó y corrigió la cámara y el tubo. Ningún otro modelo ha mirado lo que hizo. Aun así, lo que se ve en el tour sigue mal.
- 981 k tokens en 11 peticiones, el máximo del benchmark.
