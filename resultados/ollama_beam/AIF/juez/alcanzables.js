// node juez/alcanzables.js salida/web-reactiva-alchemy.html — ejecuta la parte de datos del juego y recorre las recetas
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const datos = src.slice(src.indexOf('const E = ['), src.indexOf("const STORAGE="));
const { E, BASE, RECIPES, R } = new Function(datos.replace(/function findIdByName/, 'function findIdByName') + ';return {E,BASE,RECIPES,R}')();
const have = new Set(BASE); let ch = true;
while (ch) { ch = false; for (const a of have) for (const b of have) { const r = RECIPES[[a, b].sort().join('|')]; if (r && !have.has(r)) { have.add(r); ch = true; } } }
console.log({ elementos: E.length, recetas: Object.keys(R).length, alcanzables: E.filter(e => have.has(e.id)).length,
  elementos_inventados_por_ensureElement: E.filter(e => e.emoji === '✨').map(e => e.name).slice(0, 12) });
