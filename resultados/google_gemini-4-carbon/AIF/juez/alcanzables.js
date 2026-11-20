// node juez/alcanzables.js salida/index.html — cuántos elementos oficiales se pueden descubrir de verdad jugando
// desde los cuatro iniciales, con la misma regla que el juego (RECIPE_MAP: la primera receta de cada par gana).
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const js = src.slice(src.indexOf('const OFFICIAL_ELEMENTS'), src.indexOf('// === SECTION 2: ENGINE ==='));
const { OFFICIAL_ELEMENTS, RAW_RECIPES } = eval(js + ';({OFFICIAL_ELEMENTS,RAW_RECIPES})');
const key = (a, b) => (a < b ? `${a}+${b}` : `${b}+${a}`);
const map = new Map();
for (const [a, b, r] of RAW_RECIPES) if (!map.has(key(a, b))) map.set(key(a, b), r);
const ids = new Set(OFFICIAL_ELEMENTS.map(e => e.id));
const have = new Set(OFFICIAL_ELEMENTS.filter(e => e.starter).map(e => e.id));
let ch = true;
while (ch) {
  ch = false;
  for (const a of have) for (const b of have) {
    const r = map.get(key(a, b));
    if (r && !have.has(r)) { have.add(r); ch = true; }
  }
}
const pisadas = RAW_RECIPES.filter(([a, b, r]) => map.get(key(a, b)) !== r).length;
console.log({
  elementos: ids.size, iniciales: OFFICIAL_ELEMENTS.filter(e => e.starter).length, recetas: RAW_RECIPES.length,
  pares_unicos: map.size, recetas_pisadas: pisadas, alcanzables: have.size,
  no_alcanzables: [...ids].filter(i => !have.has(i)),
  ids_inexistentes: [...new Set(RAW_RECIPES.flat().filter(i => !ids.has(i)))],
});
