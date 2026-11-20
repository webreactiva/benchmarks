// node juez/recorrido.mjs <copia-de-salida> <carpeta-capturas>
// La ruta guiada arranca sola. Mide fps y apunta la parada cada 30 s durante 2 minutos (render por software a
// ~1-3 fps con dt limitado: todo va unas 10-15 veces más lento que en un navegador normal); luego pausa, salta a
// varias paradas con la barra inferior y espera a que la cámara llegue.
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [dir, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + path.resolve(dir, 'alhambra-3d.html'));
await p.waitForTimeout(6000);
const fps = await p.evaluate(() => new Promise(r => {
  let n = 0; const t0 = performance.now();
  const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n / 3); };
  requestAnimationFrame(f);
}));
const res = { fps, auto: [] };
for (let s = 30; s <= 120; s += 30) {
  await p.waitForTimeout(30000);
  res.auto.push([s, await p.textContent('#stop-badge'), await p.textContent('#stop-title')]);
}
await p.screenshot({ path: out + '/auto-2min.png' });
if ((await p.textContent('#btn-play')).includes('Pausar')) await p.click('#btn-play');
const rail = p.locator('#stops-rail button, #stops-rail > *');
res.botones = await rail.count();
for (let i = 1; i < res.botones; i++) {
  await rail.nth(i).click();
  await p.waitForTimeout(25000);
  res[`parada-${i + 1}`] = await p.textContent('#stop-title');
  await p.screenshot({ path: `${out}/parada-${i + 1}.png` });
}
res.errores = errs;
console.log(JSON.stringify(res, null, 1));
await b.close();
