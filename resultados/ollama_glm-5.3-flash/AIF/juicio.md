# AIF · ollama/glm-5.3-flash · 8/10

**Buen juego; el Web Reactiva, inventado.** La mecánica es de las mejores, pero el contenido no es de Web Reactiva.

> Tercera tirada: la primera se cortó en el tope de 32 000 tokens de OpenCode y la segunda compactó sin parar por nuestra configuración de límites. Las dos están en `_descartados/`.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| mecánica de Infinite Craft | 2 |
| las combinaciones funcionan | 2 |
| progresión | 1 |
| «infinito» | 1 |
| contenido de Web Reactiva | 0 |
| acabado | 1 |
| **Total** | **8** |

## Validación
- Carga sin errores; un HTML de 25 KB.
- Se abre con una bienvenida («¡A construir!») que hay que cerrar. Después, Internet sobre Radio y Cine sobre Juego dan descubrimientos nuevos (`capturas/tras-mezclas.png`).
- Las 145 recetas son alcanzables desde los cuatro iniciales; las mezclas sin receta generan una «invención rara» 🎲.

## Lo que está bien
- Mesa infinita con zoom y desplazamiento, fichas que se sueltan una sobre otra, panel con buscador, sonido, guardado y una misión.

## Lo que falla
- **El contenido**: parte de Internet, Radio, Cine y Juego y llega a «Web Reactiva», «Nacho Ojea», «Trece Tigres», «La Red», ZX Spectrum, GeoCities… Nada de eso es Web Reactiva (programación, IA, agentes, la comunidad Malandriner).
- Arrastrar desde la barra lateral a la mesa no añade fichas.

## Rarezas de la sesión
- 4 peticiones: escribió el HTML entero en una llamada de 48 000 tokens y lo comprobó con Node.
- No miró la web y se inventó presentadores.
