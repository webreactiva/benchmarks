# A3D · claude-fable-5-2 · 10/10

**Maqueta completa que se recorre**

## Validación

- Un solo HTML (`alhambra-ruta-3d.html`, 730 KB) con three.js 0.160 incrustado. Carga sin errores de consola, también en las once vistas con `#p=N`.
- Recorrido (`juez/recorrido.mjs`): con «Iniciar recorrido» la cámara baja al camino y lo sigue a ras de suelo hasta la parada siguiente, gira 11 s y continúa sola. En el contenedor va a 1 fps y con `dt ≤ 0,1`: en 5 minutos pasa de la vista general a la parada 3. En un navegador normal serían unos 30 s.
- Paradas (`juez/paradas.mjs`): las diez paradas con su enlace propio y la de los Leones de noche.

## Lo que está bien

- **La ruta.** Diez paradas reales en el orden en que se visita: Puerta de la Justicia, Alcazaba y Torre de la Vela, Carlos V, Mexuar, Arrayanes, Leones, Partal, Paseo de las Torres, Jardines Nuevos del Generalife y Patio de la Acequia. Antes, una vista general desde el Albaicín.
- **Se recorre de verdad.** Entre paradas vecinas la cámara camina por el camino amarillo, pasa al pie de la torre de la Justicia y recorre la plaza de armas de la Alcazaba, sin atravesar muros. También hay lista lateral, Anterior y Siguiente, flechas y espacio, minimapa con la posición y la dirección de la cámara, y enlaces `#p=N&luz=noche`.
- **Se reconoce sin leer.**
  - el arco de herradura de la Justicia en su torre;
  - las torres almenadas de la Alcazaba con los cimientos del barrio castrense;
  - el cuadrado de Carlos V con su patio circular de dos pisos;
  - la alberca de Arrayanes con la torre de Comares detrás;
  - el pórtico de cinco arcos del Partal sobre su alberca;
  - el Patio de la Acequia con su galería y los surtidores cruzados;
  - los setos y cipreses de los Jardines Nuevos.

  Además, el Albaicín de casitas blancas enfrente y la sierra al fondo.
- **Las fichas.** Cada una lleva fecha y promotor, un texto y un «no te pierdas». Los datos son correctos:
  - la mano y la llave de la Justicia;
  - la Vela de 27 m;
  - Carlos V de 63 m con un patio de 30 m;
  - la alberca de 34 m y Comares de 45 m;
  - las 124 columnas de los Leones;
  - las tres infantas de Irving;
  - los surtidores de la Acequia, del siglo XIX.
- **Tres luces:** día, atardecer y noche, esta con las ventanas encendidas.

## Lo que falta o está mal

- El Patio de los Leones se ve desde arriba entre tejados grandes: un patio estrecho con columnas y una fuente pequeña, sin los templetes que menciona la ficha. Es la parada que menos se luce.
- Cada parada lleva un disco blanco y un haz de luz vertical que la marcan. Son pequeños y no tapan la escena, pero en Carlos V el disco cae en medio del patio.
- La sierra del fondo son colinas sin nieve; Sierra Nevada solo sale en el texto.

## Rarezas de la sesión

- Se hizo capturas con Chrome sin interfaz de cada parada y las juntó en hojas de contactos. Las miró y corrigió encuadres (la ficha tapaba parte de la escena), el color de la vegetación y la cubierta de Carlos V.
- La sesión acabó con dos procesos de capturas aún en segundo plano y el último mensaje «Esperando a que termine el lote de capturas para revisar las paradas restantes». El lanzador vio a Claude Code parado y lo cerró. Los cambios ya estaban en el HTML; le faltaba revisar las paradas 7 a 10.
- Bajó three.js de jsDelivr y lo metió dentro del HTML para que funcione sin conexión.
- 9 peticiones, 1,15 millones de tokens (950 000 de caché) y 87 000 de salida.
