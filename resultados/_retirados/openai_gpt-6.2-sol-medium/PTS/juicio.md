# PTS · gpt-6.2-sol (medium) · 8/10

**Limpio, centrado y corto**

## Validación

- `slop.py`: 607 palabras, 4 títulos, sin listas, frase media de 15,7 palabras, 0 marcas de slop.
- Hay un único fichero, `tests-que-fallan-a-veces.md`, y coincide con lo que dice en el chat.

## Lo que está bien

- La tesis tiene mecanismo: cada fallo que se relanza enseña a relanzar el siguiente, y el día que el fallo es una regresión real (correos que se pierden) el equipo pulsa «Reintentar» por costumbre.
- No se va del tema. Todo gira en torno al test intermitente: el coste de cada ejecución, que pasar al segundo intento no demuestra nada, y qué hacer mientras se investiga.
- El caso de la cola de correos está bien elegido: la espera fija de 100 ms, por qué subirla a un segundo no lo arregla y cómo sustituirla por una señal con plazo máximo.
- La cuarentena se plantea con condiciones: el test sigue ejecutándose, tiene responsable y fecha de revisión, y antes se mira qué cobertura se pierde.
- Sin slop y con un tono de post de verdad, sin listas.

## Lo que falta o está mal

- 607 palabras: por debajo del mínimo de 700.
- Un solo ejemplo y sin código. El cambio de la espera fija a la señal se explica con palabras, cuando aquí pedía unas líneas de test.

## Rarezas de la sesión

- Antes de escribir busca un `AGENTS.md` en la carpeta vacía.
- Escribe el post de un tirón con un heredoc: dos llamadas a herramientas y tres peticiones. No lo relee.
