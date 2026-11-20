// node juez/recorrido.mjs <copia-de-salida> <carpeta-capturas>
// Pulsa «Iniciar ruta guiada», mide fps y captura a los 30 s y a los 90 s (el render por software va a ~1-2 fps y la
// escena limita dt a 0,05, así que todo va unas 10-15 veces más lento que en un navegador normal). Luego salta a
// varias paradas desde el itinerario y espera a que acabe el vuelo de cámara; por último, la vista aérea.
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [dir, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + path.resolve(dir, 'alhambra-ruta-3d.html'));
await p.waitForTimeout(5000);
const fps = await p.evaluate(() => new Promise(r => {
  let n = 0; const t0 = performance.now();
  const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n / 3); };
  requestAnimationFrame(f);
}));
const estado = async () => [await p.textContent('#stopKicker'), await p.textContent('#stopName')];
await p.click('#btnStart');
await p.waitForTimeout(30000);
const res = { fps, auto_30s: await estado() };
await p.screenshot({ path: out + '/auto-30s.png' });
await p.waitForTimeout(60000);
res.auto_90s = await estado();
await p.screenshot({ path: out + '/auto-90s.png' });
if ((await p.textContent('#btnPlay')).includes('Pausa')) await p.click('#btnPlay');
const items = p.locator('#stops li');
res.paradas = await items.count();
for (const i of [2, 4, 6, 7, 8]) {
  await items.nth(i).click();
  await p.waitForTimeout(30000);
  res[`parada-${i + 1}`] = await estado();
  await p.screenshot({ path: `${out}/parada-${i + 1}.png` });
}
await p.click('#btnOverview');
await p.waitForTimeout(30000);
await p.screenshot({ path: out + '/aerea.png' });
res.errores = errs;
console.log(JSON.stringify(res, null, 1));
await b.close();
