// node juez/alcanzables.mjs salida/index.html — calcula en el navegador, con las recetas ya parcheadas por el juego
import { createRequire } from 'node:module'; import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + path.resolve(process.argv[2])); await p.waitForTimeout(1000);
console.log(await p.evaluate(() => {
  const k = (a, c) => [a, c].sort().join('+'); const have = new Set(['codigo', 'ia', 'cafe', 'comunidad']); let ch = true;
  while (ch) { ch = false; for (const a of have) for (const c of have) { const r = RECIPES[k(a, c)]; if (r && !have.has(r)) { have.add(r); ch = true; } } }
  const ids = ELEMENTS.map(e => e.id);
  return { elementos: ids.length, recetas: Object.keys(RECIPES).length, alcanzables: ids.filter(i => have.has(i)).length,
    no_alcanzables: ids.filter(i => !have.has(i)).slice(0, 12), dan_humo: Object.values(RECIPES).filter(r => r === 'humo').length };
}));
await b.close();
