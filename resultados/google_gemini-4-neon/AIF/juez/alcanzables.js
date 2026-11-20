// node juez/alcanzables.js salida/index.html — elementos alcanzables desde los iniciales, con la regla del juego
// (RECIPE_MAP: la primera receta de cada par gana).
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const js = src.slice(src.indexOf('const ELEMENTS = {'), src.indexOf('const RECIPE_MAP = new Map()'));
const { ELEMENTS, RAW_RECIPES } = new Function(js + ';return {ELEMENTS,RAW_RECIPES}')();
const key = (a, b) => (a < b ? `${a}+${b}` : `${b}+${a}`);
const map = new Map(); for (const [a, b, r] of RAW_RECIPES) if (!map.has(key(a, b))) map.set(key(a, b), r);
const ids = new Set(Object.keys(ELEMENTS));
const starters = [...ids].filter(i => ELEMENTS[i].starter);
const have = new Set(starters); let ch = true;
while (ch) { ch = false; for (const a of have) for (const b of have) { const r = map.get(key(a, b)); if (r && !have.has(r)) { have.add(r); ch = true; } } }
console.log({ elementos: ids.size, iniciales: starters, recetas: map.size, alcanzables: have.size, no_alcanzables: [...ids].filter(i => !have.has(i)),
  ids_inexistentes: [...new Set(RAW_RECIPES.flat().filter(i => !ids.has(i)))] });
