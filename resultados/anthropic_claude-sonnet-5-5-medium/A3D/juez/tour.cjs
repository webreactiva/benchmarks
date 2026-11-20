// node juez/tour.cjs  — copia el HTML a un temporal, pulsa «Comenzar la ruta» y captura a los 10 s, 30 s, en una parada intermedia y en vista Dron.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const dir = path.resolve(__dirname, '..');
const src = path.join(dir, 'salida', 'alhambra_ruta_3d.html');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a3d-sonnet-')); const copia = path.join(tmp, 'a.html'); fs.copyFileSync(src, copia);
const caps = path.join(dir, 'capturas');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const err = []; p.on('pageerror', e => err.push(e.message)); p.on('console', m => { if (m.type() === 'error') err.push(m.text()); });
  await p.goto('file://' + copia); await p.waitForTimeout(5000);
  const ficha = () => p.evaluate(() => ({ card: document.getElementById('card')?.innerText.replace(/\n+/g, ' | ').slice(0, 200), prog: document.getElementById('prog')?.value }));
  await p.click('#go'); const t0 = Date.now();
  for (const s of [10, 20, 30, 45, 60]) { await p.waitForTimeout(s * 1000 - (Date.now() - t0)); await p.screenshot({ path: path.join(caps, `tour-${s}s.png`) }); console.log(s + 's', JSON.stringify(await ficha())); }
  // parada intermedia: saltar a la 6 (Leones) desde la lista
  await p.click('#play').catch(() => {});
  await p.locator('#stops >> text=Patio de los Leones').click(); await p.waitForTimeout(8000);
  await p.screenshot({ path: path.join(caps, 'parada-6.png') }); console.log('parada6', JSON.stringify(await ficha()));
  await p.locator('#stops >> text=Patio de los Arrayanes').click(); await p.waitForTimeout(8000);
  await p.screenshot({ path: path.join(caps, 'parada-5.png') }); console.log('parada5', JSON.stringify(await ficha()));
  await p.locator('#stops >> text=Palacio de Carlos V').click(); await p.waitForTimeout(8000);
  await p.screenshot({ path: path.join(caps, 'parada-3.png') }); console.log('parada3', JSON.stringify(await ficha()));
  await p.click('button[data-m="aerial"]'); await p.waitForTimeout(6000);
  await p.screenshot({ path: path.join(caps, 'dron.png') }); console.log('dron', JSON.stringify(await ficha()));
  console.log('errores', err); await b.close();
})();
