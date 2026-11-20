Voy a crear el diagrama. Primero lanzo la instalación de `mermaid-cli` en segundo plano para poder renderizar a PNG/SVG:

---

Ahora el documento principal en Markdown con los diagramas embebidos y la explicación:

---

Listo. En la carpeta actual `/var/tmp/bench/ws-p7ErX8Mc`:

- **`wikipedia-arquitectura.md`** — documento en español con los 4 diagramas Mermaid embebidos (se renderizan solos en GitHub/VS Code) más la explicación de cada capa.
- **`wikipedia-arquitectura.mmd/.svg/.png`** — diagrama general por capas: clientes → borde (anycast, Varnish, CDN, API Gateway) → apiserver → MediaWiki Core → servicios auxiliares (Parsoid, Wikidata, CirrusSearch) → cachés (APCu, Memcached WAN, Redis) → datos (MariaDB primaria/réplicas, Elasticsearch, Swift, EventStreams/Kafka, HDFS/Druid) → plataforma (K8s, Puppet, Prometheus).
- **`wikipedia-datacenters.*`** — reparto geográfico: anycast, `eqiad`/`codfw` (app+DB), `esams`/`druid` (Swift, data lake, EventStreams), centros `*ord`/`eqsin`/`uyord` de solo lectura.
- **`wikipedia-flujo-lectura.*`** y **`wikipedia-flujo-escritura.*`** — diagramas de secuencia: caché de borde → WAN → réplicas, y escritura → primaria → cola de trabajos → reindexado + eventos.

Los 4 bloques Mermaid fueron validados renderizándolos con `mermaid-cli` (sin errores ni solapamiento de nodos).
