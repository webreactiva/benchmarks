// node recorrido.mjs <copia-de-salida> <carpeta-capturas>
// Arranca la ruta guiada y captura a los 10 s y 30 s; luego salta a paradas concretas (4, 5, 8) y a la vista aérea.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import path from 'path';
const [dir, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + path.resolve(dir, 'alhambra-ruta-3d.html'));
await p.waitForTimeout(4000);
await p.click('#btn-play');
await p.waitForTimeout(10000);
await p.screenshot({ path: out + '/auto-10s.png' });
const t10 = await p.textContent('#stop-title');
await p.waitForTimeout(20000);
await p.screenshot({ path: out + '/auto-30s.png' });
const t30 = await p.textContent('#stop-title');
const pr = await p.textContent('#progress-label');
await p.click('#btn-play');
const pills = await p.$$('#stops-strip button');
for (const i of [3, 4, 7]) {
  await pills[i].click();
  await p.waitForTimeout(5000);
  await p.screenshot({ path: `${out}/parada-${i + 1}.png` });
}
await p.click('#btn-overview');
await p.waitForTimeout(5000);
await p.screenshot({ path: out + '/aerea.png' });
console.log(JSON.stringify({ t10, t30, progreso30: pr, errores: errs }));
await b.close();
