# TCI · ollama/kimi-k3.1-pro · 6/10

**El que mejor clasifica, el más caro**

## Validación

Clasificación comparada con jev (`juez/bloques-juntados.jsonl`): tipo 96,7 %, superficie 89,0 %, F1 de áreas 0,712, idénticas a jev 32,9 %. El coste suma el agente principal y los 10 subagentes (base de datos de OpenCode).

| | |
|---|---:|
| Tokens | 2.419.197 |
| Peticiones | 117 |
| Tiempo | 418 s |
| Coste (precio de OpenRouter) | ≈ 1,23 $ |

Rúbrica: calidad 6/6 (tipo 1, superficie 2, áreas 3) y eficiencia 0/4 (tokens 0, tiempo 0, peticiones 0). **Nota: 6/10.**

## Lo que está bien

- Es el que más se parece a jev de todos los probados: 0,712 de F1 en áreas, por encima de Inkling-2-small (0,687) y de Opus 5.5 (0,668).
- Se organiza bien: unas instrucciones con criterios por etiqueta y subagentes que leen el texto completo de cada incidencia, sin atajos.

## Lo que falta o está mal

- Cuesta lo que cuesta: unas 40 veces Haiku 5.5 y más que Opus 5.5 para la misma tarea.

## Rarezas de la sesión

- Escribió unas instrucciones de clasificación propias (.instrucciones_clasificacion.md) y lanzó 10 subagentes de 30 incidencias cada uno.
- Los 10 subagentes gastaron 2,2 M de los 2,4 M de tokens; lanzar.sh solo apuntó los 252 k del agente principal.
