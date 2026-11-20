# Arquitectura de Wikipedia (diagrama Mermaid)

Diagrama simplificado de la infraestructura de Wikipedia, operada por la Fundación Wikimedia. Los servicios y nombres concretos cambian con el tiempo, así que debe tomarse como una vista aproximada.

```mermaid
flowchart TD

    subgraph USR["Usuarios"]
        LECTOR["Lectores"]
        EDITOR["Editores"]
        BOT["Bots y clientes de la API"]
    end

    subgraph EDGE["Capa de borde"]
        DNS["DNS con enrutamiento geográfico"]
        CDN["CDN y caché HTTP<br/>(Varnish y Apache Traffic Server)"]
        LB["Balanceadores de carga<br/>(LVS y nginx)"]
    end

    subgraph APP["Capa de aplicación"]
        MW["MediaWiki<br/>(PHP, php-fpm)"]
        PARSOID["Parsoid<br/>(Node.js, wikitexto ↔ HTML)"]
        REST["API REST y Action API"]
        JOBS["Ejecutores de trabajos asíncronos<br/>(job queue)"]
        THUMB["Thumbor<br/>(miniaturas de imágenes)"]
    end

    subgraph DATA["Almacenamiento y datos"]
        DB[("MariaDB<br/>primario + réplicas por sección")]
        MC[("Memcached<br/>caché de objetos y de parser")]
        SWIFT[("Swift<br/>archivos multimedia")]
        ES[("Elasticsearch<br/>CirrusSearch")]
        WDQS[("Wikidata Query Service<br/>grafo RDF / SPARQL")]
    end

    subgraph EVT["Eventos y análisis"]
        KAFKA["Apache Kafka<br/>flujos de eventos"]
        ANAL["Pipeline de analítica<br/>(Hadoop, Hive, Spark)"]
    end

    LECTOR -->|"HTTPS"| DNS
    BOT -->|"HTTPS"| DNS
    EDITOR -->|"HTTPS"| DNS
    DNS --> CDN
    CDN -->|"acierto de caché"| LECTOR
    CDN -->|"fallo de caché"| LB
    LB --> MW
    LB --> REST
    EDITOR -.->|"guardar página"| LB

    MW -->|"wikitexto"| PARSOID
    PARSOID -->|"HTML renderizado"| MW
    REST --> MW
    REST --> PARSOID

    MW -->|"lecturas y escrituras"| DB
    MW -->|"caché"| MC
    MW -->|"búsqueda"| ES
    MW -->|"encolar tareas"| JOBS
    JOBS --> DB
    JOBS --> ES

    MW -->|"subida de archivos"| SWIFT
    LECTOR -.->|"imágenes"| THUMB
    THUMB --> SWIFT
    CDN -.->|"imágenes cacheadas"| LECTOR

    BOT -->|"consultas SPARQL"| WDQS
    MW -->|"datos de Wikidata"| WDQS

    MW -->|"publica eventos"| KAFKA
    JOBS -->|"publica eventos"| KAFKA
    KAFKA --> ANAL
    KAFKA --> ES
    KAFKA --> WDQS

    classDef usuario fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef borde fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef app fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef datos fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c
    classDef evento fill:#fce4ec,stroke:#ad1457,color:#880e4f

    class LECTOR,EDITOR,BOT usuario
    class DNS,CDN,LB borde
    class MW,PARSOID,REST,JOBS,THUMB app
    class DB,MC,SWIFT,ES,WDQS datos
    class KAFKA,ANAL evento
```

## Componentes principales

- **Borde (CDN):** las peticiones de lectura se sirven desde cachés HTTP cercanas al usuario; solo los fallos llegan al origen.
- **MediaWiki:** software PHP que genera las páginas, gestiona la edición, los usuarios y los permisos.
- **Parsoid:** convierte entre wikitexto y HTML para el editor visual y la API.
- **Bases de datos:** MariaDB en configuración primario/réplicas, con caché de objetos en Memcached.
- **Medios:** archivos originales en Swift; las miniaturas se generan bajo demanda con Thumbor.
- **Búsqueda:** Elasticsearch mediante CirrusSearch.
- **Wikidata:** servicio de consultas SPARQL sobre datos RDF.
- **Eventos y análisis:** Kafka distribuye los eventos a búsqueda, Wikidata y al pipeline de analítica.
