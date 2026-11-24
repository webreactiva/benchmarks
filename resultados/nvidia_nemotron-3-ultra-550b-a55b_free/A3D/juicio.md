# A3D · nemotron-3-ultra-550b-a55b:free · 2/10

**Funciona, poco Alhambra.** Es una ruta en 3D, en un solo HTML, que se abre y se recorre. Lo que no hay es Alhambra: un visitante no reconocería ningún sitio sin las etiquetas.

## Nota del autor

**2/10**, nota definitiva de Daniel Primo. Ajuste del autor.

La rúbrica le daba 6/10.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 0 |
| ruta con paradas reales | 2 |
| la ruta se recorre | 3 |
| se reconoce la Alhambra | 0 |
| vista limpia | 0 |
| textos sin errores | 1 |
| **Total** | **6** |

## Validación
- Carga sin errores de consola. three.js 0.160 desde unpkg con `importmap` (hace falta internet).
- Al pulsar «Iniciar tour» la barra avanza y la cámara recorre la curva: a los 38 s va por el Patio de los Arrayanes y el Salón de Embajadores (`capturas/tour-8s.png`, `tour-38s.png`).
- Dos `TypeError` al iniciar el tour, dentro de `CatmullRomCurve3.getPoint`: le llega un `t` fuera de rango. No para la animación.

## Lo que está bien
- 14 paradas reales y en un orden de visita creíble: Puerta de la Justicia, Aljibes, Alcazaba y Torre de la Vela, Carlos V, Arrayanes, Embajadores, Leones, Abencerrajes, Reyes, Daraxa, Baños, Generalife, Patio de la Acequia, Escalera del Agua. Cada una con una frase.
- Controles completos: play/pausa, reiniciar, lista para saltar a una parada, órbita y zoom, teclas.
- Interfaz cuidada en español, con etiquetas sobre la escena.

## Lo que falta o está mal
- **Los edificios son primitivas**: prismas marrones, un cilindro rojo, columnas sueltas. Ni arcos, ni patios con agua, ni el estanque de Arrayanes, ni los leones, ni la colina de la Sabika.
- **La cámara se mete dentro de los volúmenes** (segunda captura: media pantalla es la pared de un prisma).
- Etiquetas encimadas en la vista inicial (9, 10, 11 y 8 se pisan).
- Los «copos» grises cuadrados ensucian la escena más de lo que ambientan.

## Rarezas de la sesión
- 3 peticiones: escribe 28 KB de golpe, lista el fichero y contesta. No lo abre ni lo comprueba.
- En el chat dice «14 paradas» y enumera 12.
