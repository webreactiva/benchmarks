# MWP · nemotron-3-ultra-550b-a55b:free · 4/10

**Funciona a medias.** El Mermaid compila con mermaid 11 y se lee como una arquitectura web de manual, pero no como la de Wikipedia.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| compila | 2 |
| en español | 0 |
| camino conectado | 0 |
| piezas clave | 1 |
| sin errores ni inventos | 0 |
| se puede leer | 1 |
| **Total** | **4** |

## Lo que está bien
- Compila sin errores (56 líneas, `graph TB`, 6 subgrafos).
- Nombra las piezas reales grandes: MediaWiki en PHP, Varnish como CDN, MariaDB primaria con réplicas, Elasticsearch (CirrusSearch), Swift para ficheros, Parsoid, RESTBase, Mathoid, cola de trabajos, Prometheus/Grafana, Logstash, Gerrit.
- Separa bien por capas.

## Lo que falta o está mal
- **El subgrafo Cliente queda suelto**: `Navegador → API Cliente` y `Navegador → App Móvil`, sin ninguna flecha hacia el CDN. El punto de entrada del sistema no entra en el sistema.
- **«En español» se cumple a medias**: `Edge Layer`, `Application Layer`, `Data Layer`, `Load Balancer`, `Session Store`, `PDF Rendering` siguen en inglés.
- No dibuja **Memcached**, que es una pieza de la arquitectura de Wikipedia (no del Mermaid): la caché en memoria donde MediaWiki guarda objetos, sesiones y el HTML ya renderizado. Sin ella el diagrama deja fuera por qué Wikipedia aguanta su tráfico. Falta Apache Traffic Server (la capa de caché de backend), Thumbor para miniaturas y Wikidata.
- **VisualEditor** aparece como servicio de servidor: es una extensión del lado del navegador.
- `SSL Termination` tampoco recibe tráfico de nadie.
- Ninguna explicación: solo el `.mmd` y cómo abrirlo.

## Rarezas de la sesión
- 2 peticiones: escribe el fichero a la primera y contesta. No investiga ni comprueba que compile.
- En la tanda descartada (con las skills del `HOME` cargadas) sacó otro diagrama con piezas distintas (Thumbor, OCG, Puppet). La pregunta tiene mucha varianza entre tiradas.
