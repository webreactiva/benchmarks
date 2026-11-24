# TCI · ollama/kimi-k3.1-pro · 6/10 (proyectada)

**El que mejor clasifica, el más caro**

## Validación

El límite de uso de Ollama Cloud cortó la sesión con 7 de sus 10 bloques terminados (incidencias 31 a 240) y sin el `clasificacion.jsonl` final. Por decisión del autor no se repite: la nota es una **proyección**. Ninguna incidencia la ha clasificado el juez.

- **Calidad**, medida en las 210 incidencias que clasificó (`juez/bloques-juntados.jsonl`) contra jev, y supuesta igual en las 90 restantes: tipo 96,7 %, superficie 89,0 %, F1 de áreas 0,712, idénticas a jev 32,9 %.
- **Coste**, real hasta el corte sumando el agente principal y los 10 subagentes (base de datos de OpenCode), más lo que les faltaba a los tres bloques cortados y la fusión final.

| | Real hasta el corte | Proyectado (300) |
|---|---:|---:|
| Tokens | 2.419.197 | 2.694.541 |
| Peticiones | 117 | 134 |
| Tiempo | 418 s | ~478 s |
| Coste (precio de OpenRouter) | ≈ 1,23 $ | ≈ 1,37 $ |

Rúbrica: calidad 6/6 (tipo 1, superficie 2, áreas 3) y eficiencia 0/4 (2,7 M de tokens y 1,37 $; 478 s; 134 peticiones). **Nota proyectada: 6/10.**

## Lo que está bien

- Es el que más se parece a jev de todos los probados: 0,712 de F1 en áreas, por encima de Inkling-2-small (0,687) y de Opus 5.5 (0,668).
- Se organiza bien: unas instrucciones con criterios por etiqueta y subagentes que leen el texto completo de cada incidencia, sin atajos.

## Lo que falta o está mal

- Cuesta lo que cuesta: unas 45 veces Haiku 5.5 y el doble que Opus 5.5 para la misma tarea, y el gasto agotó la cuenta.
- La calidad es de una muestra (el 70 %); el F1 de las 300 podría moverse unas centésimas.

## Rarezas de la sesión

- Nota proyectada, por decisión del autor: el límite de uso de Ollama la cortó y no se repite porque Kimi es caro. La calidad se mide en las 210 incidencias que clasificó; el coste suma lo real hasta el corte y lo que le faltaba.
- Escribió unas instrucciones de clasificación propias (.instrucciones_clasificacion.md) y lanzó 10 subagentes de 30 incidencias cada uno, que leen el texto completo de cada incidencia.
- Los 10 subagentes gastaron 2,2 M de los 2,4 M de tokens reales; lanzar.sh solo apuntó los 252 k del agente principal.
- Supera el techo de calidad en áreas (0,712), aunque medido sobre el 70 % de las incidencias.
