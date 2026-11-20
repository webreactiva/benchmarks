# claude-haiku-5-5

Agente: Claude Code. Fechas: 2026-11-19 a 2026-11-19.

**Nota media: 8,0 / 10** (4 de 4 prompts juzgados). Total: 29 peticiones y 1960,4 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 11 | 981,1 k | 8 | funciona, la ruta tapa la Alhambra | Un HTML con three.js sin errores, con paisaje (cielo, Sierra Nevada nevada, torres con tejado, cipreses del Generalife), 10 paradas con texto bueno y controles completos. Pero el tubo amarillo de la ruta y el marcador ocupan media pantalla durante el tour, y los edificios siguen siendo bloques. | [▶ alhambra-ruta-3d.html](https://webreactiva.github.io/benchmarks/resultados/anthropic_claude-haiku-5-5/A3D/salida/alhambra-ruta-3d.html) |
| [AIF](AIF/juicio.md) | visual | 5 | 268,4 k | 9 | se juega y es de Web Reactiva | Mesa de juego como Infinite Craft (arrastrar y soltar una cosa sobre otra), 54 elementos y 50 recetas, todas alcanzables desde Código, Humano, Idea y Café. El contenido sale de webreactiva.com de verdad: agentes, skills, MCP, SDD, OpenSpec, AI slop, podcast, cursos. Le falta lo infinito: con una tabla fija, la mayoría de mezclas no dan nada. | [▶ alquimia-web-reactiva.html](https://webreactiva.github.io/benchmarks/resultados/anthropic_claude-haiku-5-5/AIF/salida/alquimia-web-reactiva.html) |
| [CCA](CCA/juicio.md) | código | 11 | 635,8 k | 9 | escala de verdad | Librería JS sin dependencias que resuelve lo que «escalable» exige: servicio sin estado, concurrencia optimista por versión con reintentos, dinero en céntimos, una moneda por carrito, precios del catálogo y no del cliente, dominio inmutable, reglas de precio e impuestos. 30 tests en verde. Le falta un adaptador real (solo memoria), caducidad de carritos y espera entre reintentos. | – |
| [PTS](PTS/juicio.md) | texto | 2 | 75,1 k | 6 | bien | 953 palabras con un argumento de verdad: un test inestable enseña al equipo a ignorar el rojo («normalización del fallo») y da una seguridad falsa que sin tests no existe. Un caso concreto (timeout de red, regresión de facturación que se pierde) y cinco prácticas útiles. Le sobran la lista con etiquetas en negrita, la «Conclusión» y una cita inventada. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, servido por GitHub Pages.

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

**CCA**

- Ajustó tres tests y en los tres lo explica: dos cuentas mal hechas en sus propias expectativas y el límite de reintentos del test de concurrencia.
- Comprueba el ejemplo a mano en el chat (848 ¢ − 150 − 15 = 683 ¢, IVA 68 ¢, total 751 ¢) y cuadra.
- 11 peticiones pero 636 k tokens, el que más ha gastado: el 88 % es lectura de caché del contexto que crece en cada vuelta.
- Todo el texto (comentarios, README, respuesta) en español; los identificadores, en inglés.

**PTS**

- «Como decía alguien en una charla que no recuerdo bien»: se inventa una fuente que no puede nombrar.
- Amplía el tema a los tests que llevan semanas en rojo, no solo a los que fallan a veces.
- Responde a su propio título con «Entonces, ¿mejor no tener tests? No.», que matiza la tesis que le pedían defender.
