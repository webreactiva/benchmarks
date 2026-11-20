// node juez/alcanzables.js salida/alquimia-web-reactiva.html — alcanzables desde BASE_IDS con la clave del juego ([a,b].sort().join("||"))
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const { ELEMENTS, RECIPES, BASE_IDS } = new Function(src.slice(src.indexOf('const ELEMENTS'), src.indexOf('const LEVEL = {}')) + ';return {ELEMENTS,RECIPES,BASE_IDS}')();
const id = e => e.id ?? e[0]; const k = (a, b) => [a, b].sort().join('||');
const R = RECIPES.map(r => Array.isArray(r) ? [r[1], r[2], r[0]] : [r.a, r.b, r.r ?? r.result ?? r.out]);  // el juego guarda [resultado, a, b]
const m = new Map(R.map(([a, b, r]) => [k(a, b), r]));
const have = new Set(BASE_IDS); let ch = true;
while (ch) { ch = false; for (const a of have) for (const b of have) { const r = m.get(k(a, b)); if (r && !have.has(r)) { have.add(r); ch = true; } } }
const ids = ELEMENTS.map(id);
console.log({ elementos: ids.length, recetas: R.length, alcanzables: ids.filter(i => have.has(i)).length, ejemplo_receta: R[0] });
