# AIF · ollama/inkling-2-small · 9/10

**Se juega; Web Reactiva, a medias.** Mesa libre con fichas que se combinan soltando una sobre otra, 125 elementos todos alcanzables y un generador para las mezclas sin receta. Parte de Agua, Fuego, Aire y Tierra y mezcla programación genérica (React, Rust, Docker) con algo de Web Reactiva (podcast, masterclass, «Maratón WR», «Membresía WR», «Slow Content»), sin mirar la web.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| mecánica de Infinite Craft | 2 |
| las combinaciones funcionan | 2 |
| progresión | 1 |
| «infinito» | 1 |
| contenido de Web Reactiva | 1 |
| acabado | 1 |
| **Total** | **9** |

## Validación
- Carga sin errores; un HTML de 41 KB sin dependencias.
- Mover una ficha de la mesa sobre otra combina: Agua sobre Fuego da un elemento nuevo (`capturas/tras-mezclas.png`).
- Soltar un elemento de la barra directamente sobre una ficha no combina: hay que soltarlo primero en la mesa.
- `juez/alcanzables.js` (mío, con el `pairKey` del juego): 125 de 125 elementos alcanzables, 127 recetas, ninguna referencia rota.

## Lo que está bien
- Mecánica de Infinite Craft: mesa libre, papelera, chispas, sonidos y un generador que da un elemento a cualquier mezcla sin receta.
- Progreso guardado, buscador y contador.

## Lo que falla
- El contenido: empieza con los cuatro elementos clásicos y la mayor parte es programación genérica; lo de Web Reactiva son unos pocos nombres sacados de memoria.

## Rarezas de la sesión
- Dice «no puedo ver imágenes en este modelo» y comprueba la captura por el DOM. El modelo sí acepta imágenes: es nuestra configuración de OpenCode, que no declara qué entradas admite cada modelo.
- No consultó la web para el contenido.
- 15 peticiones y 689 k tokens.
