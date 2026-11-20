// node paradas.mjs <copia-de-salida> <carpeta-capturas>
// Mide los fps del render por software, captura las paradas 3 y 4 y arranca la ruta guiada desde el 42 %.
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [dir, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('file://' + path.resolve(dir, 'alhambra-ruta-3d.html'));
await p.waitForTimeout(4000);
const fps = await p.evaluate(() => new Promise(r => {
  let n = 0; const t0 = performance.now();
  const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n / 3); };
  requestAnimationFrame(f);
}));
const pills = await p.$$('#stops-strip button');
for (const i of [2, 3]) {
  await pills[i].click();
  await p.waitForTimeout(8000);
  await p.screenshot({ path: `${out}/parada-${i + 1}.png` });
}
await p.$eval('#route-slider', s => { s.value = 420; s.dispatchEvent(new Event('input')); });
await p.click('#btn-play');
await p.waitForTimeout(20000);
await p.screenshot({ path: `${out}/auto-desde-42.png` });
console.log(JSON.stringify({ fps, titulo: await p.textContent('#stop-title'), progreso: await p.textContent('#progress-label') }));
await b.close();
