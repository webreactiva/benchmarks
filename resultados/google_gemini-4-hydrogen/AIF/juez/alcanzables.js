// node juez/alcanzables.js salida/index.html — cuántos elementos se pueden descubrir de verdad jugando desde los
// cuatro iniciales, con la misma regla que el juego (RECIPES: la primera receta de cada par gana).
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const js = src.slice(src.indexOf('const ELEMENTS = {'), src.indexOf('const RECIPES = new Map()'));
const { ELEMENTS, RAW_RECIPES } = eval(js + ';({ELEMENTS,RAW_RECIPES})');
const STARTERS = eval(src.match(/const STARTERS = (\[[^\]]*\])/)[1]);
const key = (a, b) => (a < b ? `${a}+${b}` : `${b}+${a}`);
const map = new Map();
for (const [a, b, r] of RAW_RECIPES) if (!map.has(key(a, b))) map.set(key(a, b), r);
const ids = new Set(Object.keys(ELEMENTS));
const have = new Set(STARTERS);
let ch = true;
while (ch) {
  ch = false;
  for (const a of have) for (const b of have) {
    const r = map.get(key(a, b));
    if (r && !have.has(r)) { have.add(r); ch = true; }
  }
}
console.log({
  elementos: ids.size, iniciales: STARTERS, recetas: RAW_RECIPES.length, pares_unicos: map.size,
  alcanzables: have.size, no_alcanzables: [...ids].filter(i => !have.has(i)),
  ids_inexistentes: [...new Set(RAW_RECIPES.flat().filter(i => !ids.has(i)))],
  pares_iniciales_sin_receta: STARTERS.flatMap((a, i) => STARTERS.slice(i).map(b => [a, b])).filter(([a, b]) => !map.has(key(a, b))).map(x => x.join('+')),
});
