# AIF · ollama/deepseek-v4.1-flash · 9/10

**Infinite Craft de verdad.** Es el que mejor copia la mecánica: un lienzo donde sueltas una cosa encima de otra.

> Repetición con los límites reales del modelo. La primera prueba se cortó en el tope de 32 000 tokens de salida de OpenCode y está en `_descartados/`.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| mecánica de Infinite Craft | 2 |
| las combinaciones funcionan | 2 |
| progresión | 1 |
| «infinito» | 0 |
| contenido de Web Reactiva | 2 |
| acabado | 1 |
| **Total** | **9** |

## Validación
- Carga sin errores; un HTML de 86 KB sin dependencias.
- Arrastrando: Developer sobre IA → **Copiloto**; Café sobre Prompt → **Idea** (`capturas/tras-mezclas.png`).
- `juez/alcanzables.js` (mío, con el `pairKey` del juego): **78 de 78 elementos alcanzables**, el Atlas Malandriner incluido; ninguna referencia rota.

## Lo que está bien
- Lienzo libre, almacén con buscador, doble clic para duplicar, pista que sugiere la siguiente mezcla, sonido, progreso guardado.
- Una misión que da sentido al juego: llegar al **Atlas Malandriner**.
- Contenido sacado de webreactiva.com y de /now.
- Pie «Un tributo a webreactiva.com · Inspirado en Infinite Craft».

## Lo que falta
- No es infinito: 90 recetas fijas; el resto de mezclas no da nada.

## Rarezas de la sesión
- Esta vez su respuesta más larga fue de 27 180 tokens: no le hacía falta más de 32 000. La vez anterior intentó escribirlo todo de una sola vez.
- 32 peticiones y 2,6 millones de tokens.
