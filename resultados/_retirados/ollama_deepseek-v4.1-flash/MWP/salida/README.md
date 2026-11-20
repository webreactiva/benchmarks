# Arquitectura de Wikipedia en Mermaid

Diagrama de alto nivel de la arquitectura de Wikipedia/Wikimedia, escrito en español.

## Archivos

- `arquitectura-wikipedia.mmd`: código Mermaid del diagrama.
- `arquitectura-wikipedia.svg`: versión renderizada (vectorial).
- `arquitectura-wikipedia.png`: versión renderizada (imagen).

## Cómo renderizarlo

Con la CLI oficial de Mermaid:

```bash
npx @mermaid-js/mermaid-cli -i arquitectura-wikipedia.mmd -o arquitectura-wikipedia.svg
```

También puedes pegar el contenido en <https://mermaid.live> o incluirlo en Markdown:

````markdown
```mermaid
flowchart TB
    %% ... contenido de arquitectura-wikipedia.mmd ...
```
````

## Capas representadas

1. **Clientes**: navegadores, apps móviles, bots y clientes de la API.
2. **Borde**: DNS, CDN con caché HTTP (Varnish) y balanceo de carga (LVS).
3. **Aplicación**: servidores MediaWiki (Apache + PHP-FPM), API, autenticación y sesiones.
4. **Servicios de contenido**: Parsoid, RESTBase, CirrusSearch y Wikidata Query Service.
5. **Datos**: Memcached, MariaDB, Elasticsearch, Swift y almacén de medios.
6. **Asíncrono**: Kafka, cola de trabajos, ChangeProp y escaladores de miniaturas.

## Flujo de una petición

1. El cliente resuelve el dominio por **DNS** y llega a la **CDN**.
2. Si hay acierto de caché, la CDN responde directamente.
3. Si hay fallo de caché, el **balanceador** envía la petición a **MediaWiki**.
4. MediaWiki usa **Memcached** para caché, **MariaDB** para el contenido, **Elasticsearch** para búsquedas y **Swift** para medios.
5. Los trabajos pesados o diferidos se envían a **Kafka** y se procesan en segundo plano.
