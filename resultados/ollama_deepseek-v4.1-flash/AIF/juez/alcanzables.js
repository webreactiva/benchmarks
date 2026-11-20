// node juez/alcanzables.js salida/index.html — recetas alcanzables desde BASE con el pairKey del propio juego
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const datos = src.slice(src.indexOf('const BASE'), src.indexOf('const RECIPE_MAP'));
// pairKey va dentro del bloque de datos
const { BASE, ELEMENTS, RECIPES, pairKey } = eval(datos + ';({BASE,ELEMENTS,RECIPES,pairKey})');
const map = new Map(RECIPES.map(([a, b, r]) => [pairKey(a, b), r]));
const have = new Set(BASE); let ch = true;
while (ch) { ch = false; for (const a of have) for (const b of have) { const r = map.get(pairKey(a, b)); if (r && !have.has(r)) { have.add(r); ch = true; } } }
const ids = Object.keys(ELEMENTS);
console.log({ elementos: ids.length, recetas: RECIPES.length, alcanzables: have.size, no_alcanzables: ids.filter(i => !have.has(i)),
  ingredientes_inexistentes: [...new Set(RECIPES.flat().filter(x => !ELEMENTS[x]))], atlas: have.has('atlas') || [...have].some(x => /atlas/.test(x)) });
