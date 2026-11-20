# MWP · ollama/minimax-m3 · 8/10

**El más completo.** Cuatro diagramas y un documento que los explica. Más de lo pedido, y casi todo correcto.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| compila | 2 |
| en español | 1 |
| camino conectado | 2 |
| piezas clave | 2 |
| sin errores ni inventos | 1 |
| se puede leer | 0 |
| **Total** | **8** |

## Validación
- Cuatro `.mmd` (arquitectura, centros de datos, flujo de lectura, flujo de escritura) y los cuatro bloques del `.md`: todos compilan con mermaid 11.
- Con mermaid 11.4 los títulos de subgrafo «1. Clientes», «2. Capa de borde»… salen como «Unsupported markdown: list», porque los toma por listas de Markdown. En el PNG que generó el modelo, con otra versión, salen bien.

## Lo que está bien
- Ocho capas con piezas reales y poco vistas: DNS e IP anycast, cachés de borde Varnish, CDN de estáticos (upload.wikimedia.org), Wikimedia API Gateway, Action API y REST API, APCu local y Memcached WAN por centro de datos, MariaDB primaria y réplicas, Swift con miniaturas, Kafka (EventStreams), data lake HDFS/Druid, Kubernetes, Puppet, Prometheus, Loki.
- Flujos de lectura y de edición por separado: lo que más ayuda a entender la arquitectura.
- Un Markdown con la lectura por capas y notas de lo que simplifica.

## Lo que falla
- El diagrama general tiene tantas flechas que no se sigue.
- Cola de trabajos en Redis: hoy va sobre Kafka (ChangeProp).
- Sin tildes en los diagramas («movil», «Busqueda») y alguna errata («gestioned de configuracion»).

## Rarezas de la sesión
- Entendió la pregunta como un informe pequeño: cuatro diagramas, PNG y SVG de cada uno y un `.md`.
- Comprobó que compilaba con mermaid-cli.
- 21 peticiones y 359 k tokens.
