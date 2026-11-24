# claude-haiku-5-5

Agente: Claude Code. Fechas: 2026-11-19 a 2026-11-24.

**Nota media: 8,2 / 10** (5 de 5 prompts juzgados). Total: 50 peticiones y 3929,4 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 11 | 981,1 k | 8 | funciona, la ruta tapa la Alhambra | Un HTML con three.js sin errores, con paisaje (cielo, Sierra Nevada nevada, torres con tejado, cipreses del Generalife), 10 paradas con texto bueno y controles completos. Pero el tubo amarillo de la ruta y el marcador ocupan media pantalla durante el tour, y los edificios siguen siendo bloques. | [▶ alhambra-ruta-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/anthropic_claude-haiku-5-5/A3D/salida/alhambra-ruta-3d.html) |
| [AIF](AIF/juicio.md) | visual | 5 | 268,4 k | 9 | se juega y es de Web Reactiva | Mesa de juego como Infinite Craft (arrastrar y soltar una cosa sobre otra), 54 elementos y 50 recetas, todas alcanzables desde Código, Humano, Idea y Café. El contenido sale de webreactiva.com de verdad: agentes, skills, MCP, SDD, OpenSpec, AI slop, podcast, cursos. Le falta lo infinito: con una tabla fija, la mayoría de mezclas no dan nada. | [▶ alquimia-web-reactiva.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/anthropic_claude-haiku-5-5/AIF/salida/alquimia-web-reactiva.html) |
| [SEC](SEC/juicio.md) | seguridad | 15 | 1545,2 k | 6 | Cobertura alta, sin CWE | Informe de 45 hallazgos con fichero y línea en casi todos: cubre 25 de las 40 entradas con la regla estricta (F3 61,3), 35 con el criterio del juez, y solo 4 no son fallos. Se le escapan el oráculo de padding, la fuga de la URL interna del asistente, el IDOR de wishlists y la página de noticias; no da ningún CWE. | – |
| [CCA](CCA/juicio.md) | código | 11 | 635,8 k | 9 | escala de verdad | Librería JS sin dependencias que resuelve lo que «escalable» exige: servicio sin estado, concurrencia optimista por versión con reintentos, dinero en céntimos, una moneda por carrito, precios del catálogo y no del cliente, dominio inmutable, reglas de precio e impuestos. 30 tests en verde. Le falta un adaptador real (solo memoria), caducidad de carritos y espera entre reintentos. | – |
| [TCI](TCI/juicio.md) | clasificación | 8 | 498,9 k | 9 | Casi igual, por céntimos | Tipo 96,3 %, superficie 85,7 % y F1 de áreas 0,617 frente a jev (63 incidencias idénticas). Le costó 113 s, 8 peticiones y 499 k tokens (≈ 0,03 $). | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Se hizo capturas de su propia página con Chrome headless, las miró y corrigió la cámara y el grosor del tubo. Es el único modelo que ha comprobado visualmente lo que hizo.
- 981 k tokens en 11 peticiones, el que más ha gastado: leer tres capturas y reescribir 55 k tokens de salida.
- Avisa en la propia página de que es una «maqueta esquemática» con posiciones aproximadas.

**AIF**

- Fue a internet para hacerlo: una búsqueda web y una lectura de la portada de webreactiva.com pidiendo temas, herramientas, cursos y podcast. Nemotron no consultó nada.
- Comprobó con un script que los 54 elementos son alcanzables y que no hay referencias rotas, y reconoce que no probó el arrastre en un navegador.
- Añade un pie «Fan project… No está afiliado a webreactiva.com».
- Termina ofreciendo «publicarlo en una URL compartible», algo que nadie le pidió.

**SEC**

- Dice que el proyecto «parece un laboratorio de entrenamiento en seguridad» por las flags QKB{…} y los identificadores «case-…»; no nombra el proyecto original.
- No usa subagentes esta vez (en la tirada anterior lanzó tres en segundo plano y el lanzador cortó; ver _descartados).
- No sale a internet: no ejecuta npm audit y cita los CVE de Next de memoria, avisando de que hay que confirmarlos.
- Lista como hallazgos un bug funcional (reduce sin valor inicial) y un desajuste de versiones de eslint.
- No toca el código: solo crea auditoria-seguridad.md.

**CCA**

- Ajustó tres tests y en los tres lo explica: dos cuentas mal hechas en sus propias expectativas y el límite de reintentos del test de concurrencia.
- Comprueba el ejemplo a mano en el chat (848 ¢ − 150 − 15 = 683 ¢, IVA 68 ¢, total 751 ¢) y cuadra.
- 11 peticiones pero 636 k tokens, el que más ha gastado: el 88 % es lectura de caché del contexto que crece en cada vuelta.
- Todo el texto (comentarios, README, respuesta) en español; los identificadores, en inglés.

**TCI**

- Clasifica con un script que resume cada incidencia en el título y 150 caracteres; lo dice en su respuesta («el título y el inicio de cada texto, no el cuerpo completo»). Por eso falla windows-os y sandbox cuando el dato está más abajo, en la plantilla.
- Añade un campo «nota» a 29 incidencias que le parecen retiradas, duplicadas o vacías.
