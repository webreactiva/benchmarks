# A3D · ollama/glm-5.3 · 6/10

**Bonita, con tropiezos.** Nueve paradas que se recorren y una maqueta que se reconoce, pero con vistas tapadas y un dato equivocado.

## Nota del autor

**6/10**, nota definitiva de Daniel Primo. La visita guiada funciona, pero se presenta de una forma un poco rara.

La rúbrica le daba 8/10.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| ruta con paradas reales | 2 |
| la ruta se recorre | 3 |
| se reconoce la Alhambra | 2 |
| vista limpia | 0 |
| textos sin errores | 0 |
| **Total** | **8** |

## Validación
- Carga sin errores; 61 KB con three.js 0.160 desde jsDelivr. Empieza con una portada y «Iniciar ruta guiada».
- Nueve paradas en orden de visita: Justicia, Alcazaba, Plaza de los Aljibes, Mexuar, Arrayanes, Embajadores, Leones, Carlos V, Generalife.
- La ruta guiada avanza sola: 8,5 s de escena en cada parada y un vuelo de cámara a la siguiente. Con el render por software a 3 fps llega a la parada 3 a los 4 minutos (`juez/auto-largo.mjs`); en un navegador normal, cada parada dura unos 10 s.
- El itinerario y los botones vuelan a cada parada (`juez/recorrido.mjs`); la vista aérea enseña todo el recinto (`aerea.png`).

## Lo que está bien
- Se reconoce: murallas y torres almenadas, Carlos V cuadrado con el patio circular, la fuente de los doce leones entre arquerías, el Patio de la Acequia con surtidores y la Escalera del Agua, Sierra Nevada al fondo.
- Una línea dorada con caminantes marca el itinerario real, subiendo por la Cuesta de Gomérez.

## Lo que falta o está mal
- En Arrayanes la cámara queda contra un muro y el estanque apenas asoma (`parada-5.png`); en Leones el marcador «7» tapa media pantalla (`parada-7.png`).
- «Aquí se hospedó Washington Irving» en la Plaza de los Aljibes: se alojó en las habitaciones del palacio.
- Depende de un CDN.

## Rarezas de la sesión
- Lo reescribió entero tras revisar la geometría y lo probó en Chrome con Playwright: capturas del tour y análisis de los píxeles para comprobar que el cielo y la piedra se veían.
- Buscó navegadores también en `/root/.cache/ms-playwright` (vacío dentro del encierro).
- 21 peticiones y 3,1 millones de tokens (2,9 de caché).
