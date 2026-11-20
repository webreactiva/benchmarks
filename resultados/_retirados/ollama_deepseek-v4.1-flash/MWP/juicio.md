# MWP · ollama/deepseek-v4.1-flash · 9/10

**Bien y comprobado.** Un diagrama limpio y completo, y además el único que el modelo renderizó para ver que funcionaba.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| compila | 2 |
| en español | 1 |
| camino conectado | 2 |
| piezas clave | 2 |
| sin errores ni inventos | 1 |
| se puede leer | 1 |
| **Total** | **9** |

## Validación
- `arquitectura-wikipedia.mmd` y el bloque del `README.md` compilan con mermaid 11. Entrega también el PNG y el SVG que generó él.

## Lo que está bien
- Todo en español y en capas claras de arriba abajo: Clientes → Borde (DNS, Varnish, LVS) → MediaWiki (Apache + PHP-FPM) → Servicios de contenido → Datos.
- Las piezas buenas: Memcached, MariaDB, Elasticsearch vía CirrusSearch, Swift, Parsoid, RESTBase, CentralAuth.
- **Capa asíncrona bien pensada**: Kafka → JobQueue y ChangeProp, JobQueue → escaladores de miniaturas → almacén de medios. Así es como funciona.
- README con el diagrama y una explicación.

## Lo que falla
- MediaWiki → Wikidata Query Service: MediaWiki no lee de WDQS.
- Swift y «Almacén de medios» aparecen como dos cajas distintas cuando son lo mismo.
- Ninguna flecha de vuelta al usuario ni acierto de caché.

## Rarezas de la sesión
- Instaló `@mermaid-js/mermaid-cli` con `npx`, le falló Chrome por el sandbox, lo arregló con un `pptr.json`, generó PNG y SVG y miró la imagen. Ningún otro modelo comprobó que su Mermaid compilaba.
- Ese `pptr.json` lo dejó en `/tmp/opencode`, fuera de su carpeta.
- 10 peticiones, frente a 2 de los demás en este prompt.
