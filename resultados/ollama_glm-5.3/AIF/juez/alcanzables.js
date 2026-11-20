// node juez/alcanzables.js salida/alquimia-reactiva.html — cuántos elementos curados se pueden descubrir de verdad
// desde los cuatro básicos, con la misma regla que el juego (norm() de los nombres; si dos recetas chocan, gana la
// última, como hace recipes.set).
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const datos = src.slice(src.indexOf('<script id="gamedata">') + '<script id="gamedata">'.length);
const window = {};
eval(datos.slice(0, datos.indexOf('</script>')));
const G = window.GAME_DATA;
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const ids = new Set([...G.bases.map(b => norm(b.name)), ...G.crafted.map(c => norm(c[0]))]);
const map = new Map(); const malas = []; let choques = 0;
for (const [name, , ...pairs] of G.crafted) for (const p of pairs) {
  const [a, b] = p.split('+').map(s => norm(s.trim()));
  if (!ids.has(a) || !ids.has(b)) { malas.push(`${name}: ${p}`); continue; }
  if (map.has(key(a, b))) choques++;
  map.set(key(a, b), norm(name));
}
const have = new Set(G.bases.map(b => norm(b.name)));
let ch = true;
while (ch) {
  ch = false;
  for (const a of have) for (const b of have) { const r = map.get(key(a, b)); if (r && !have.has(r)) { have.add(r); ch = true; } }
}
console.log({ elementos: ids.size, bases: G.bases.map(b => b.name), recetas: map.size, choques, ingredientes_desconocidos: malas,
  alcanzables: have.size, no_alcanzables: [...ids].filter(i => !have.has(i)) });
