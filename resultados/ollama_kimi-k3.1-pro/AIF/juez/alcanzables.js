// node juez/alcanzables.js salida/index.html — elementos alcanzables desde BASE_IDS con las recetas del juego
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const ini = src.indexOf('const ELEMENT_LIST'), fin = src.indexOf('const LEVELS');
const { ELEMENT_LIST, BASE_IDS, RECIPE_LIST } = new Function(src.slice(ini, fin) + ';return {ELEMENT_LIST,BASE_IDS,RECIPE_LIST}')();
const m = new Map(RECIPE_LIST.map(r => [r.key, r.result]));
const have = new Set(BASE_IDS); let ch = true;
while (ch) { ch = false; for (const a of have) for (const b of have) { const r = m.get([a, b].sort().join('|')); if (r && !have.has(r)) { have.add(r); ch = true; } } }
const ids = ELEMENT_LIST.map(e => e[0]);
console.log({ elementos: ids.length, recetas: RECIPE_LIST.length, alcanzables: ids.filter(i => have.has(i)).length,
  no_alcanzables: ids.filter(i => !have.has(i)), ingredientes_inexistentes: [...new Set(RECIPE_LIST.flatMap(r => [r.a, r.b, r.result]).filter(x => !ids.includes(x)))] });
