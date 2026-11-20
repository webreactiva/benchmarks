// node juez/alcanzables.js <copia de alquimia-reactiva.html> — elementos alcanzables desde BASE, con el parser y key() del propio juego
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const datos = src.slice(src.indexOf('const BASE'), src.indexOf('const GOALS'));
const { BASE, RECIPES, ALL, key } = eval(datos + ';({BASE,RECIPES,ALL,key})');
const lineas = src.match(/RECIPES_TXT = `([\s\S]*?)`/)[1].trim().split('\n').filter(Boolean);
const have = new Set(Object.keys(BASE)); let ch = true;
while (ch) { ch = false; for (const a of have) for (const b of have) { const r = RECIPES.get(key(a, b)); if (r && !have.has(r.r)) { have.add(r.r); ch = true; } } }
const wr = /Web Reactiva|Malandriner|Dani Primo|Podcast|Newsletter|Episodio|Oyente|Suscriptores|Audiencia|Temporada|Invitado|Premium|Retos/;
console.log({ elementos: ALL.size, lineas_de_receta: lineas.length, recetas_distintas: RECIPES.size, alcanzables: have.size,
  no_alcanzables: [...ALL].filter(n => !have.has(n)), resultados_con_varias_recetas: lineas.length - new Set(lineas.map(l => l.split(' = ')[1])).size,
  elementos_de_web_reactiva: [...ALL].filter(n => wr.test(n)) });
