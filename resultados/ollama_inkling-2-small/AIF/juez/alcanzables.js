// node juez/alcanzables.js salida/alquimia-reactiva.html — elementos alcanzables desde BASE_IDS con el pairKey del juego
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const blk = src.slice(src.indexOf('const ELEMENTS'), src.indexOf('const RECIPES = {}'));
const { ELEMENTS, RECIPES_RAW } = eval(blk + ';({ELEMENTS,RECIPES_RAW})');
const pairKey = (a, b) => [a, b].sort().join('+');
const map = new Map(RECIPES_RAW.map(([a, b, r]) => [pairKey(a, b), r]));
const have = new Set(['agua', 'fuego', 'aire', 'tierra']); let ch = true;
while (ch) { ch = false; for (const a of have) for (const b of have) { const r = map.get(pairKey(a, b)); if (r && !have.has(r)) { have.add(r); ch = true; } } }
const ids = Object.keys(ELEMENTS);
console.log({ elementos: ids.length, recetas: RECIPES_RAW.length, alcanzables: ids.filter(i => have.has(i)).length,
  no_alcanzables: ids.filter(i => !have.has(i)), ingredientes_inexistentes: [...new Set(RECIPES_RAW.flat().filter(x => !ELEMENTS[x]))] });
