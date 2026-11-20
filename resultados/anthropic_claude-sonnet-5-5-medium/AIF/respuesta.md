Validación rápida de recetas y alcanzabilidad.

---

He creado el juego en `/var/tmp/bench/ws-3GqejEVH/alquimia-web-reactiva.html`, un único archivo HTML sin dependencias. Comprobé que las 63 recetas no se repiten y que todos los elementos se pueden conseguir desde los cuatro iniciales. No lo he abierto en un navegador, así que el arrastre y el diseño sin probar en pantalla.

"Web Reactiva" puede significar programación reactiva o diseño responsive, así que usé los dos: señales, Virtual DOM, Vue o Svelte por un lado, y media queries, Grid, Flexbox, `clamp()` o Mobile First por el otro. Si te referías a una web o curso concreto, dime qué temas incluye y adapto los elementos.

**Cómo se juega**
- Empiezas con 🧠 Estado, ⚡ Evento, 🟦 Píxel y 🖥️ Pantalla.
- Arrastras un elemento sobre otro para combinarlos. Por ejemplo, Estado + Evento da Reactividad.
- La meta es **Web Reactiva**, que sale de Programación Reactiva + Responsive Design, aunque hay más elementos para descubrir.
- Cada descubrimiento muestra una breve explicación del concepto.

**Detalles**
- Si dos elementos no se combinan, tiemblan y aparece "no pasa nada".
- Un clic en la lista coloca el elemento en el área, y doble clic sobre uno del área lo duplica.
- Soltar un elemento sobre la lista lo borra del área.
- Hay buscador, contador de progreso y marca "NUEVO" en lo recién descubierto.
- El progreso se guarda en el navegador, y hay botones para vaciar el área y reiniciar.
- Funciona con ratón y con táctil, y la lista pasa abajo en pantallas estrechas.
- Sigue el tema claro u oscuro del sistema y tiene un botón para cambiarlo.

A diferencia de Infinite Craft, no usa IA: las combinaciones sin receta no producen nada. Para ampliarlo, añade líneas en `ELEMENTS` y `RECIPES` dentro del propio archivo.
