# A3D · ollama/inkling-2-small · 9/10

**Bonita y se recorre.** Maqueta clara del cerro de la Sabika con muralla, Alcazaba con bandera, Comares, Generalife con su alberca, Albaicín, el Darro y Sierra Nevada, 9 paradas con textos correctos y un recorrido automático que viaja de verdad. Pero al bajar a los patios la cámara se mete en los muros, y Comares sale como una torre redonda con cúpula.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| ruta con paradas reales | 2 |
| la ruta se recorre | 3 |
| se reconoce la Alhambra | 2 |
| vista limpia | 0 |
| textos sin errores | 1 |
| **Total** | **9** |

## Validación
- Carga sin errores; un HTML de 43 KB con three.js desde CDN.
- Vista inicial (`capturas/inicio.png`): el recinto entero sobre el cerro, Albaicín, Darro y Sierra Nevada, con etiquetas de cada parada.
- «Recorrido»: a los 10 s está en el Patio de los Arrayanes con la alberca y la torre al fondo (`auto-10s.png`); a los 30 s, en Leones, con media pantalla tapada por un muro (`auto-30s.png`).
- Los botones ‹ › cambian la ficha y mueven la cámara poco (`siguiente-x4.png`).

## Lo que está bien
- 9 paradas en orden de visita, de la panorámica desde la Vega al mirador del Albaicín, con textos correctos (doce leones de mármol, Mocárabes y Dos Hermanas).
- Índice lateral, puntos de progreso, brújula, vista libre, teclado y enlace a una parada con `?p=N`.

## Lo que falla
- La cámara atraviesa muros al bajar a los patios.
- La Torre de Comares es cuadrada; aquí es un cilindro con cúpula.
- Etiquetas amontonadas en la vista general.

## Rarezas de la sesión
- Lo probó en Chrome headless en varias paradas y lo retocó con 11 ediciones.
- Buscó navegadores (chromium, puppeteer, playwright) para probarlo; corría encerrado y solo vio lo del sistema.
- 24 peticiones y 1,2 millones de tokens, sin compactaciones.
