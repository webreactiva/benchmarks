// node juez/alcanzables.js salida/alchemy.html — qué recetas se pueden descubrir de verdad jugando (getKey ordena los ids)
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const js = src.slice(src.indexOf('const BASE_ELEMENTS'), src.indexOf('const CATEGORY_COLORS'));
const { BASE_ELEMENTS, RECIPES } = eval(js + ';({BASE_ELEMENTS,RECIPES})');
const keys = Object.keys(RECIPES);
const have = new Set(BASE_ELEMENTS.map(e => e.id)); let ch = true;
while (ch) { ch = false; for (const a of have) for (const b of have) { const r = RECIPES[[a, b].sort().join('+')]; if (r && !have.has(r.id)) { have.add(r.id); ch = true; } } }
const ids = new Set([...BASE_ELEMENTS.map(e => e.id), ...keys.map(k => RECIPES[k].id)]);
console.log({ recetas: keys.length, claves_desordenadas: keys.filter(k => k.split('+').sort().join('+') !== k).length,
  descubribles: have.size - BASE_ELEMENTS.length, ingredientes_inexistentes: [...new Set(keys.flatMap(k => k.split('+')).filter(p => !ids.has(p)))] });
