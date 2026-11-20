# PTS · gpt-6.2-astra (default) · 9/10

**Afilado, con código, corto**

## Validación

- `slop.py`: 611 palabras, 4 títulos, sin listas, frase media de 15,9 palabras, 0,2 marcas de slop por cada 100 palabras (una negrita y un cierre «La próxima vez que»).
- Hay un único fichero, `tests-intermitentes.md`, y coincide con lo que dice en el chat.

## Lo que está bien

- La tesis tiene mecanismo: relanzar tiene sentido para quien quiere entregar su cambio, pero repetido por todo el equipo hace que el jueves nadie lea el fallo que sí era una regresión (el cálculo del IVA).
- Ejemplo con código y números: un `time.sleep(0.5)` que en el portátil sobra (20 ms) y en la CI no llega (700 ms). Explica por qué subir la pausa no lo arregla y qué esperar en su lugar.
- Buen detalle: conservar el primer fallo, porque no es lo mismo que el correo llegara dos décimas tarde que no llegara a la cola.
- Cuarentena con condiciones: sigue ejecutándose, tiene responsable y fecha.

## Lo que falta o está mal

- 611 palabras: por debajo del mínimo de 700.

## Rarezas de la sesión

- Cinco peticiones para un post: lo escribe y lo relee antes de contestar.
