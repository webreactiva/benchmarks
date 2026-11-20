// node juez/tour.cjs — copia el HTML a un temporal; el recorrido arranca solo al cargar. Captura a los 10, 30, 60 y 90 s,
// luego salta a cada parada desde la lista (capturas de todas en el temporal, las de Arrayanes y Leones en capturas/) y prueba la vista libre.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const dir = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a3d-opus-')); const copia = path.join(tmp, 'a.html');
fs.copyFileSync(path.join(dir, 'salida', 'alhambra-ruta-3d.html'), copia);
const caps = path.join(dir, 'capturas');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const err = []; p.on('pageerror', e => err.push(e.message)); p.on('console', m => { if (m.type() === 'error') err.push(m.text()); });
  await p.goto('file://' + copia); const t0 = Date.now();
  const ficha = () => p.evaluate(() => (document.getElementById('card')?.innerText || '').replace(/\n+/g, ' | ').slice(0, 120) + ' || ' + (document.getElementById('enroute')?.innerText || '').replace(/\n+/g, ' '));
  for (const s of [10, 30, 60, 90]) { await p.waitForTimeout(s * 1000 - (Date.now() - t0)); await p.screenshot({ path: path.join(caps, `tour-${s}s.png`) }); console.log(s + 's', await ficha()); }
  const n = await p.locator('#stops li, #stops button, #stops > *').count(); console.log('paradas en la lista', n);
  for (let i = 0; i < n; i++) { await p.locator('#stops > *').nth(i).click(); await p.waitForTimeout(7000);
    await p.screenshot({ path: path.join(tmp, `p${i + 1}.png`) }); console.log('p' + (i + 1), await ficha()); }
  fs.copyFileSync(path.join(tmp, 'p4.png'), path.join(caps, 'parada-4.png')); fs.copyFileSync(path.join(tmp, 'p5.png'), path.join(caps, 'parada-5.png'));
  await p.click('#free'); await p.mouse.move(640, 400); await p.mouse.down(); await p.mouse.move(400, 350, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(2000);
  await p.screenshot({ path: path.join(caps, 'vista-libre.png') });
  console.log('errores', err, tmp); await b.close();
})();
