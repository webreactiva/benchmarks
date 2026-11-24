# A3D · ollama/glm-5.3-flash · 6/10

**Se recorre y se reconoce.** Una ruta a pie de calle que avanza sola y una maqueta que, desde arriba, es la Alhambra.

> Tercera tirada: la primera se cortó en el tope de 32 000 tokens de OpenCode y la segunda compactó sin parar por nuestra configuración de límites. Las dos están en `_descartados/`.

## Nota del autor

**6/10**, nota definitiva de Daniel Primo. Ajuste del autor.

La rúbrica le daba 9/10.

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
- Carga sin errores; un HTML de 37 KB.
- La ruta guiada arranca sola: a los 35 s va por Carlos V y a los 60 s por Arrayanes y Comares, con la barra de progreso avanzando (`capturas/tour-35s.png`, `tour-60s.png`).
- Modo libre (`libre.png`): Torre de Comares, Carlos V cuadrado con patio circular, anillo de columnas del Patio de los Leones, Alcazaba con torres almenadas, arco de la Justicia, murallas y el Darro.

## Lo que falla
- Empieza con la cámara dentro de un muro (`inicio.png`) y en el recorrido roza las paredes: a ratos media pantalla es un muro.
- Etiquetas cortadas por los bordes.

## Rarezas de la sesión
- Es un HTML distinto al de la tirada anterior: la misma petición da obras distintas.
- Lo probó en Chrome headless, capturando 9 tramos del recorrido.
- 29 peticiones y 1,8 millones de tokens.
