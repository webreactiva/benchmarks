// node juez/alcanzables.js salida/alquimia-reactiva.html — elementos alcanzables desde los iniciales, con la regla
// del juego (recipes.set: si un par sale dos veces, gana la última receta).
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const js = src.slice(src.indexOf('const BASE = ['), src.indexOf('/*DATA-END*/'));
const { BASE, GOALS, ELEMENTS, RECIPES } = new Function(js + ';return {BASE,GOALS,ELEMENTS,RECIPES}')();
const els = new Set(ELEMENTS.trim().split('\n').map(l => l.split('|')[0]));
const key = (a, b) => (a < b ? `${a}+${b}` : `${b}+${a}`);
const map = new Map(), repetidas = [];
const lista = RECIPES.trim().split('\n').map(l => { const [lhs, out] = l.split(' = '); const [a, b] = lhs.split(' + '); return [a, b, out]; });
for (const [a, b, r] of lista) { if (map.has(key(a, b))) repetidas.push(`${a} + ${b}`); map.set(key(a, b), r); }
const have = new Set(BASE); let ch = true;
while (ch) { ch = false; for (const a of have) for (const b of have) { const r = map.get(key(a, b)); if (r && !have.has(r)) { have.add(r); ch = true; } } }
console.log(JSON.stringify({ elementos: els.size, iniciales: BASE, objetivos: GOALS, recetas: map.size, repetidas, alcanzables: have.size,
  no_alcanzables: [...els].filter(i => !have.has(i)),
  ids_inexistentes: [...new Set(lista.flat().filter(i => !els.has(i)))],
  objetivos_alcanzables: GOALS.filter(g => have.has(g)) }, null, 1));
