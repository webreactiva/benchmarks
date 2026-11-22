// node juez/alcanzables.js salida/reactiva-craft.html — cuántos elementos se pueden descubrir de verdad desde las
// cuatro bases, con la misma regla que el juego (clave = los dos nombres ordenados; si se repite, gana la última).
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const js = src.slice(src.indexOf('const BASES = ['), src.indexOf('const ICONS = {}'));
const { BASES, R } = eval(js + ';({BASES,R})');
const key = (a, b) => [a, b].sort().join(' ␟ ');
const map = new Map(); for (const [a, b, n] of R) map.set(key(a, b), n);
const ids = new Set([...BASES.map(b => b[0]), ...R.map(r => r[2])]);
const have = new Set(BASES.map(b => b[0]));
let ch = true;
while (ch) {
  ch = false;
  for (const a of have) for (const b of have) { const r = map.get(key(a, b)); if (r && !have.has(r)) { have.add(r); ch = true; } }
}
console.log({ elementos: ids.size, recetas: map.size, alcanzables: have.size, no_alcanzables: [...ids].filter(i => !have.has(i)) });
