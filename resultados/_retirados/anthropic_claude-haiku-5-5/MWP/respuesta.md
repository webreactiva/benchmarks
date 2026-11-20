He generado el diagrama de arquitectura de Wikipedia en Mermaid, en español, y lo he guardado en la carpeta de trabajo:

- `/tmp/bench-ws/claude-haiku/MWP/arquitectura_wikipedia.mmd`: código Mermaid puro.
- `/tmp/bench-ws/claude-haiku/MWP/arquitectura_wikipedia.md`: el mismo diagrama dentro de un bloque ```mermaid, con una breve descripción de cada componente. Se puede visualizar directamente en GitHub o en cualquier visor de Markdown con Mermaid.

El diagrama agrupa la arquitectura en cinco capas:

1. **Usuarios:** lectores, editores y bots.
2. **Borde:** DNS con enrutamiento geográfico, CDN con caché HTTP (Varnish y Apache Traffic Server) y balanceadores de carga.
3. **Aplicación:** MediaWiki (PHP), Parsoid (conversión wikitexto ↔ HTML), API REST, ejecutores de trabajos asíncronos y Thumbor para miniaturas.
4. **Datos:** MariaDB con réplicas, Memcached, Swift para medios, Elasticsearch (CirrusSearch) y el Wikidata Query Service.
5. **Eventos y análisis:** Kafka y un pipeline de analítica.

Es una vista simplificada y basada en mi conocimiento, no en documentación verificada en este momento. Los servicios concretos de Wikimedia cambian con el tiempo, así que algunos nombres o conexiones pueden estar desactualizados. Si quieres una versión exacta, conviene contrastarla con la documentación técnica pública de la Fundación Wikimedia.
