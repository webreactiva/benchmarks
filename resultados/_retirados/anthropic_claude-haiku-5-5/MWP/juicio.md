# MWP · claude-haiku-5-5 (Claude Code) · 8/10

**Bien.** Un diagrama que se puede enseñar: compila, está todo en español y cuenta cómo viaja una petición, no solo qué cajas hay.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| compila | 2 |
| en español | 1 |
| camino conectado | 2 |
| piezas clave | 2 |
| sin errores ni inventos | 0 |
| se puede leer | 1 |
| **Total** | **8** |

## Validación
- `arquitectura_wikipedia.mmd` (99 líneas) y el bloque del `.md` compilan con mermaid 11. Son el mismo diagrama; el `.md` añade una lista de componentes.

## Lo que está bien
- Flujo de lectura completo: usuarios → DNS con enrutamiento geográfico → CDN (Varnish y Apache Traffic Server) → acierto de caché de vuelta al lector, fallo de caché al balanceador (LVS) → MediaWiki.
- Las piezas que se olvidan casi siempre: Memcached como caché de objetos y de parseo, MariaDB «primario + réplicas por sección», cola de trabajos asíncronos, Thumbor para miniaturas.
- Kafka repartiendo eventos a búsqueda, WDQS y analítica (Hadoop, Hive, Spark): es como funciona.
- Etiquetas en las flechas y estilos por capa. Todo en español.

## Lo que falla
- **Lectores → Thumbor directamente** («imágenes»): las miniaturas pasan por la CDN como todo lo demás.
- **Editores → balanceador** sin pasar por DNS ni CDN: la edición también entra por el borde.
- **MediaWiki → WDQS «datos de Wikidata»**: MediaWiki no lee entidades del servicio SPARQL; las saca de la propia Wikidata (otro MediaWiki).
- Con tantas flechas el dibujo se enreda en la parte de abajo.

## Rarezas de la sesión
- 2 peticiones, dos `Write`: el `.md` y el `.mmd` con el mismo diagrama.
- Avisa en el fichero y en el chat de que es una vista aproximada hecha de memoria: honesto, y ningún otro modelo lo hizo.
- De 95 k tokens, 47 k son la escritura de caché del arranque de Claude Code (su prompt de sistema y herramientas). El trabajo son 5,7 k de salida.
