# MWP · ollama/glm-5.3-flash · 8/10

**Correcto con inventos.** Bien dibujado y en español, pero con dos piezas puestas donde no van.

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
- `arquitectura_wikipedia.mmd` (98 líneas) compila con mermaid 11.

## Lo que está bien
- Todo en español, etiquetas y subgrafos.
- Camino de entrada: clientes (escritorio, móvil, apps) → GeoDNS → CDN → «fallo de caché» → balanceadores LVS.
- Memcached en su propia capa, y MariaDB con maestro para escrituras y réplicas para lecturas, con las flechas separadas.
- Elasticsearch, Swift/Ceph y Kafka.

## Lo que falla
- **«CDN (Cloudflare…)»**: Wikipedia no usa Cloudflare; su CDN son sus propios centros de caché con Varnish y Apache Traffic Server.
- **ATS como «enrutador / gateway» detrás del balanceador**: ATS es parte de esa capa de caché, no un gateway delante de MediaWiki.
- El parser escribiendo en Swift; las subidas van desde MediaWiki y las miniaturas, por Thumbor, que no aparece.
- Sin cola de trabajos, sin Wikidata, sin la vuelta del acierto de caché al usuario.

## Rarezas de la sesión
- 2 peticiones, 1,1 k tokens de salida.
