// node juez/recorrido.mjs <copia-de-salida> <carpeta-capturas>
// Pulsa «Iniciar ruta» con velocidad 4× (el render por software va a ~1-3 fps y la escena limita dt a 0,05) y
// apunta la parada cada 30 s durante 3 minutos; luego salta a varias paradas desde la lista y espera al vuelo.
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
await p.screenshot({ path: out + '/inicio.png' });
const fps = await p.evaluate(() => new Promise(r => {
  let n = 0; const t0 = performance.now();
  const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n / 3); };
  requestAnimationFrame(f);
}));
for (let i = 0; i < 2; i++) await p.click('#btn-speed');
const res = { fps, velocidad: await p.textContent('#btn-speed'), auto: [] };
await p.click('#btn-tour');
for (let s = 30; s <= 180; s += 30) {
  await p.waitForTimeout(30000);
  res.auto.push([s, await p.textContent('#info-title')]);
  if (s === 60) await p.screenshot({ path: out + '/auto-60s.png' });
}
await p.screenshot({ path: out + '/auto-180s.png' });
if (!(await p.locator('#btn-pause').isDisabled())) await p.click('#btn-pause');
const items = p.locator('#places-list li');
res.lugares = await items.count();
for (const i of [2, 3, 4, 6, 7]) {
  if (i >= res.lugares) break;
  await items.nth(i).click();
  await p.waitForTimeout(30000);
  res[`parada-${i + 1}`] = await p.textContent('#info-title');
  await p.screenshot({ path: `${out}/parada-${i + 1}.png` });
}
res.errores = errs;
console.log(JSON.stringify(res, null, 1));
await b.close();
