// node juez/recorrido.mjs <copia-de-salida> <carpeta-capturas>
// La ruta guiada arranca sola. Mide fps y cuánto avanza la barra en 20 s; luego deja la ruta en marcha desde la
// parada 4 y captura a los 30 s; después pausa, salta a varias paradas con la barra inferior y espera a que la
// cámara llegue (lerp con dt ≤ 0,05 a ~1 fps de render por software).
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
const barra = () => p.$eval('#progress-fill', e => e.style.width);
const res = { fps, barra_inicio: await barra() };
await p.waitForTimeout(20000);
res.barra_20s = await barra();
await p.screenshot({ path: out + '/auto-25s.png' });
const rail = p.locator('#waypoints-rail button');
res.botones = await rail.count();
await rail.nth(3).click();
await p.waitForTimeout(30000);
res.desde_4_tras_30s = [await barra(), await p.textContent('#stop-title')];
await p.screenshot({ path: out + '/auto-desde-4.png' });
if ((await p.textContent('#btn-play')).includes('Pausar')) await p.click('#btn-play');
for (const i of [2, 4, 5, 6, 7]) {
  await rail.nth(i).click();
  await p.waitForTimeout(25000);
  res[`parada-${i + 1}`] = await p.textContent('#stop-title');
  await p.screenshot({ path: `${out}/parada-${i + 1}.png` });
}
res.errores = errs;
console.log(JSON.stringify(res, null, 1));
await b.close();
