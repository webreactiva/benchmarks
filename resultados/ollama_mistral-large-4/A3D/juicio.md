# A3D · ollama/mistral-large-4 · 2/10

**Se recorre, entre muros.** La ruta guiada funciona, pero la cámara acaba pegada a las paredes y la Alhambra apenas se reconoce.

> Ollama Cloud cortó tres peticiones de la sesión hacia los 5 minutos (ECONNRESET y 504); OpenCode las reintentó y la sesión terminó con el fichero y su resumen. Cuenta como hecha.

## Nota del autor

**2/10**, nota definitiva de Daniel Primo. Ni se parece a la Alhambra ni tiene sentido alguno.

La rúbrica le daba 7/10.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| ruta con paradas reales | 2 |
| la ruta se recorre | 3 |
| se reconoce la Alhambra | 1 |
| vista limpia | 0 |
| textos sin errores | 0 |
| **Total** | **7** |

## Validación
- Carga sin errores; 32 KB con three.js 0.160 desde unpkg.
- Ocho paradas: Puerta de la Justicia, Alcazaba, Arrayanes, Comares, Leones, Dos Hermanas, Abencerrajes, Generalife. Falta Carlos V, pero el orden es creíble.
- «Iniciar ruta» a 4×: Arrayanes a los 30 s, Leones a los 60, Generalife a los 90, y vuelve a empezar (`juez/recorrido.mjs`, render por software a 4 fps).

## Lo que está bien
- La ruta automática funciona, con pausa, reinicio, vuelo libre y velocidad.
- Fichas cortas con la leyenda de los Abencerrajes, el Jannat al-Arif y la fuente de los doce leones.

## Lo que falta o está mal
- La cámara queda dentro o pegada a los muros: en Leones mira una caja de azulejos, en Abencerrajes y el Generalife solo hay pared (`auto-180s.png`, `parada-3.png`).
- Solo se reconocen murallas almenadas y torres; ni la fuente, ni la alberca, ni el patio de Carlos V.
- «La gran losa de mármol que da nombre» a la Sala de las Dos Hermanas: son dos losas gemelas.
- Con la ruta en pausa, pulsar un lugar de la lista no cambia la ficha.

## Rarezas de la sesión
- Ollama Cloud cortó tres de sus peticiones; `meta.json` guarda el último error («Gateway Timeout») aunque el trabajo se completó.
- Escribió el fichero, dijo que tenía un error de sintaxis y lo reescribió entero; luego tres `edit` y una comprobación de sintaxis. No lo abrió en un navegador.
- 10 peticiones y 134 000 tokens, en unos 40 minutos por los reintentos.
