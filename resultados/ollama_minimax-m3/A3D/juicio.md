# A3D · ollama/minimax-m3 · 4/10

**Lo más ambicioso, pero no se recorre.** Tiene más de todo que cualquier otro A3D, y lo único que pedía el prompt, la ruta, no funciona.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| ruta con paradas reales | 2 |
| la ruta se recorre | 0 |
| se reconoce la Alhambra | 1 |
| vista limpia | 0 |
| textos sin errores | 0 |
| **Total** | **4** |

## Validación
- Carga sin errores (70 KB, three.js con `importmap`).
- Lo que hay: 15 paradas con texto histórico y consejo de visita, vistas Guía, Cinemática, Libre y Peatón, deslizador de hora del día, voz, etiquetas y un minimapa con el trazado (`capturas/inicio.png`).
- **El recorrido apenas avanza**: 1 % a los 25 s sin tocar nada; 3 % tras 20 s a otra velocidad (`tour-12s.png`).
- **Saltar a una parada no mueve la cámara**: al pulsar «Patio de los Leones» cambia la ficha, pero la vista sigue en la plaza de entrada y el progreso marca 0 % (`leones.png`).
- **El minimapa tapa las paradas 11 a 15** de la lista: no se pueden pulsar.

## Lo que está bien
- Los textos: fechas, medidas y consejos prácticos («compra el pase anticipado: en temporada alta la cola supera las dos horas»).
- La escena tiene muralla, Torre de la Vela, galería de arcos y farolas, y cambia con la hora.
- Un minimapa con el plano y la ruta.

## Lo que falla
- La ruta en 3D, que es el encargo (arriba).
- Cielo rojo intenso a las 17:36.
- «Los leones originales están en el Museo de la Alhambra»: volvieron a la fuente tras la restauración de 2012.

## Rarezas de la sesión
- **80 peticiones y 11,4 millones de tokens**, cinco veces el siguiente gasto más alto del benchmark. Le dio vueltas y vueltas.
- Escribió el HTML en cuatro piezas en `/tmp/opencode` y las juntó al final.
- Buscó en su propio texto palabras en inglés y en chino («Muslims», «传入») para limpiarlas: se le colaban.
- Usó el Playwright del sistema y lanzó rayos contra la geometría para comprobar que la ruta no atraviesa muros. Asegura que todo funciona; la cámara no se mueve.
