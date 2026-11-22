// node juez/recorrido.mjs <copia-de-salida> <carpeta-capturas>
// Pulsa «Iniciar recorrido» y apunta la parada cada 30 s durante 5 minutos, con capturas en pleno trayecto
// (render por software a ~1-3 fps y dt limitado a 0,1: el recorrido va unas 5-10 veces más lento que en un
// navegador normal). Mide fps antes y comprueba que la cámara se mueve entre una captura y otra.
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
await p.waitForTimeout(6000);
const fps = await p.evaluate(() => new Promise(r => {
  let n = 0; const t0 = performance.now();
  const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else r(n / 4); };
  requestAnimationFrame(f);
}));
const res = { fps, boton_inicial: await p.textContent('#play'), auto: [] };
await p.click('#play');
for (let s = 30; s <= 300; s += 30) {
  await p.waitForTimeout(30000);
  const cam = await p.evaluate(() => { const o = window.__alhambra.orbit; return [o.t.x, o.t.z].map(v => Math.round(v)); });
  res.auto.push([s, await p.textContent('#kn'), await p.textContent('#ct'), cam]);
  if (s % 60 === 0) await p.screenshot({ path: `${out}/auto-${s}s.png` });
}
res.boton_final = await p.textContent('#play');
res.errores = errs;
console.log(JSON.stringify(res, null, 1));
await b.close();
