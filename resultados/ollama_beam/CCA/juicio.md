# CCA · ollama/beam · 4/10

**Funciona, pero no escala.** Node sin dependencias, 413 líneas: carrito, gestor con un cerrojo en memoria por carrito, repositorio en memoria, inventario opcional, eventos, cupones y una API HTTP, con 4 tests en verde. Pero el dinero va en coma flotante, el precio lo manda el cliente, todo vive en un proceso y no hay README.

> Repetición: en la primera tirada preguntó en texto qué stack usar y el lanzador no lo detectaba (está en `_descartados/`). En esta no preguntó.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| se ejecuta | 1 |
| tests en verde | 1 |
| dominio completo | 1 |
| dinero exacto | 0 |
| precio del catálogo y validación | 0 |
| concurrencia | 1 |
| escala horizontal | 0 |
| explica el escalado | 0 |
| **Total** | **4** |

## Validación (en una copia; `juez/juez.js` es mío)
- `npm test`: 4/4.
- 50 altas a la vez: 50 unidades (el cerrojo por carrito funciona dentro del proceso).
- 0,10 × 3 = 0.30000000000000004; un precio de 0,01 € mandado por el cliente se acepta.

## Lo que falta para «escalable»
- Almacenamiento compartido, versión o atomicidad entre instancias, dinero en céntimos, precios del catálogo y un README con las decisiones.

## Rarezas de la sesión
- En la primera tirada preguntó; en esta decidió solo y no preguntó nada.
- 20 peticiones y 240 k tokens.
- Respuesta de una línea.
