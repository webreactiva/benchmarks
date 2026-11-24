# A3D · ollama/beam · 2/10

**Funciona, pero son cajas.** El A3D más pequeño (8 KB, 209 líneas, 5 peticiones): seis paradas reales, botones para cada una y un tour automático que mueve la cámara de la Alcazaba al Generalife. Pero la Alhambra son cajas de colores rodeadas de un anillo de pilares, la cámara se pega a los volúmenes y el panel no muestra el texto de la parada durante el tour.

## Nota del autor

**2/10**, nota definitiva de Daniel Primo. Son unas cajas con líneas, como un modelo BIM: no hay nada que se pueda ver ni visualizar, ni nada que tenga forma de ningún tipo.

La rúbrica le daba 7/10.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| ruta con paradas reales | 2 |
| la ruta se recorre | 3 |
| se reconoce la Alhambra | 0 |
| vista limpia | 0 |
| textos sin errores | 1 |
| **Total** | **7** |

## Validación
- Carga sin errores; three.js 0.128 desde jsDelivr.
- Vista general (`capturas/inicio.png`): bloques rojo, marrón y verde con etiquetas y líneas amarillas.
- «Tour automático»: a los 10 s la cámara está pegada a la caja de la Alcazaba y a los 30 s sobre el plano verde del Generalife (`auto-10s.png`, `auto-30s.png`).

## Lo que está bien
- Seis paradas reales con una frase correcta cada una (Puerta de la Justicia, Alcazaba, Palacios Nazaríes, Leones, Carlos V, Generalife).
- Leyenda por tipo de edificio y un botón por parada.

## Lo que falla
- Nada se reconoce: ni torres, ni patios, ni Carlos V redondo. Los pilares en anillo no corresponden a nada.
- La cámara se mete en los volúmenes y el panel inferior sigue diciendo «Selecciona un punto de la ruta» durante el tour.

## Rarezas de la sesión
- El más rápido de todos: 5 peticiones y 64 k tokens, sin abrirlo ni probarlo.
- Contesta en una línea en inglés: «Creado … (single-file 3D Alhambra route)».
