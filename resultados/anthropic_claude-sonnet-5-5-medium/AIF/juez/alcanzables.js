// node juez/alcanzables.js <copia de alquimia-web-reactiva.html> — elementos alcanzables desde BASE, con ELEMENTS, RECIPES y key() del propio juego
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const datos = src.slice(src.indexOf('const ELEMENTS'), src.indexOf('const EL ='));
const { ELEMENTS, BASE, RECIPES, key } = eval(datos + ';({ELEMENTS,BASE,RECIPES,key})');
const lineas = RECIPES.trim().split('\n').map(l => { const [ab, r] = l.split('='); const [a, b] = ab.split('+'); return [a, b, r]; });
const map = new Map(lineas.map(([a, b, r]) => [key(a, b), r]));
const nombres = ELEMENTS.map(e => e[0]);
const have = new Set(BASE); let ch = true;
while (ch) { ch = false; for (const a of have) for (const b of have) { const r = map.get(key(a, b)); if (r && !have.has(r)) { have.add(r); ch = true; } } }
console.log({ elementos: nombres.length, recetas: lineas.length, alcanzables: have.size, no_alcanzables: nombres.filter(n => !have.has(n)),
  ingredientes_inexistentes: [...new Set(lineas.flat().filter(x => !nombres.includes(x)))], recetas_duplicadas: lineas.length - map.size });
