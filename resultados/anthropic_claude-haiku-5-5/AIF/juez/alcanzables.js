// node juez/alcanzables.js salida/alquimia-web-reactiva.html — recetas alcanzables desde BASE, con la función key() del propio juego (va dentro del bloque de datos)
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const pick = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
const datos = pick('const BASE', '/* ---------- Estado');

const { BASE, ELEMENTS, RECIPES, key } = eval(datos + ';({BASE,ELEMENTS,RECIPES,key})');
const map = new Map(RECIPES.map(([a, b, r]) => [key(a, b), r]));
const have = new Set(BASE); let ch = true;
while (ch) { ch = false; for (const a of have) for (const b of have) { const r = map.get(key(a, b)); if (r && !have.has(r)) { have.add(r); ch = true; } } }
const ids = Object.keys(ELEMENTS);
console.log({ elementos: ids.length, recetas: RECIPES.length, alcanzables: have.size, no_alcanzables: ids.filter(i => !have.has(i)),
  ingredientes_inexistentes: [...new Set(RECIPES.flat().filter(x => !ELEMENTS[x]))], recetas_duplicadas: RECIPES.length - map.size });
