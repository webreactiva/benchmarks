# PTS · ollama/inkling-2-small · 8/10

**Limpio y útil, pero se abre de tema.** 1045 palabras con la tesis bien defendida (fatiga de alertas, el rojo que deja de bloquear, «saltar con una red que no sabes si está atada»), un caso concreto de flujo de CI y un plan de salida útil (presupuesto de flakiness, cuarentena con dueño, orden aleatorio, reloj inyectado). Poco slop. Pero reparte el post entre cuatro tipos de test que falla y los intermitentes son solo uno.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| hay post | 1 |
| tesis con mecanismo | 2 |
| se ciñe al tema | 0 |
| ejemplos concretos | 1 |
| sin errores ni inventos | 1 |
| slop | 2 |
| extensión | 1 |
| **Total** | **8** |

## Medidas (`scripts/slop.py`)
- 1045 palabras, 17 títulos, frase media de 14 palabras.
- Slop 9,8 puntos, 0,9 por cada 100 palabras: 7 negritas, una lista con etiquetas en negrita, 2 rayas y «Reflexión final».

## Lo que está bien
- El caso del principio: CI rojo, reintento, verde, merge; tres semanas después el mismo test falla por un bug real y nadie lo mira «porque siempre falla».
- Cierre con imagen propia: «No tener tests es admitir que caminas sin red. Tener tests que nadie cree es saltar con una red que no sabes si está atada».
- Plan práctico: presupuesto de flakiness, cuarentena con dueño y plazo, reintentos solo para diagnosticar, causa raíz en orden (estado compartido, reloj, red, concurrencia), borrar lo que no da señal.

## Lo que falla
- Se abre de tema: clasifica cuatro casos (intermitentes, rojos congelados, desincronizados, rojo legítimo) y trata los intermitentes como uno más.
- Sin código: el ejemplo es el nombre de un test.
- Un cierre con llamada a la acción en cursiva.

## Rarezas de la sesión
- 3 peticiones y 2,2 k tokens de salida.
