// node juez/tour.cjs — copia el HTML a un temporal. El recorrido arranca solo al cargar, pero en este Chromium sin GPU
// va a ~1 fotograma/s y la página limita dt a 0,05 s: 10 s de parada son casi 3 min reales. Por eso:
// captura a los 10 s de cargar; luego velocidad 3× y «siguiente» para forzar el viaje, con capturas a los 30 y 90 s de viaje
// (ancho de la barra de progreso = posición en la ruta); después salta a cada parada desde la lista y prueba la vista libre.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const dir = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a3d-opus-')); const copia = path.join(tmp, 'a.html');
fs.copyFileSync(path.join(dir, 'salida', 'alhambra-ruta-3d.html'), copia);
const caps = path.join(dir, 'capturas');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const err = []; p.on('pageerror', e => err.push(e.message)); p.on('console', m => { if (m.type() === 'error') err.push(m.text()); });
  await p.goto('file://' + copia);
  const estado = () => p.evaluate(() => ({ card: (document.getElementById('card')?.innerText || '').split('\n')[0].slice(0, 60) + ' ' + (document.getElementById('card')?.className || ''),
    enruta: (document.getElementById('enroute')?.innerText || '').replace(/\n+/g, ' ') + ' ' + (document.getElementById('enroute')?.className || ''),
    progreso: document.querySelector('#progress i')?.style.width }));
  await p.waitForTimeout(10000); await p.screenshot({ path: path.join(caps, 'tour-10s.png') }); console.log('10s', JSON.stringify(await estado()));
  await p.evaluate(() => { const s = document.getElementById('speed'); s.value = s.max; s.dispatchEvent(new Event('input')); });
  await p.click('#next'); const t0 = Date.now();
  for (const s of [30, 90]) { await p.waitForTimeout(s * 1000 - (Date.now() - t0)); await p.screenshot({ path: path.join(caps, `viaje-${s}s.png`) }); console.log('viaje ' + s + 's', JSON.stringify(await estado())); }
  const n = await p.locator('#stops ol li').count(); console.log('paradas', n);
  for (let i = 0; i < n; i++) { const li = p.locator('#stops ol li button').nth(i);
    await li.click({ timeout: 20000 }).catch(async e => { console.log('p' + (i + 1) + ': no se puede pulsar (' + (e.message.match(/<[^>]+> from <section id="card"[^>]*>/) ? 'la ficha lo tapa' : 'timeout') + '); clic por código'); await li.dispatchEvent('click'); });
    await p.waitForTimeout(6000);
    await p.screenshot({ path: path.join(tmp, `p${i + 1}.png`) }); console.log('p' + (i + 1), JSON.stringify(await estado())); }
  fs.copyFileSync(path.join(tmp, 'p4.png'), path.join(caps, 'parada-4.png')); fs.copyFileSync(path.join(tmp, 'p5.png'), path.join(caps, 'parada-5.png'));
  await p.click('#free'); await p.waitForTimeout(1500); await p.mouse.move(640, 400); await p.mouse.down(); await p.mouse.move(500, 380, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(4000);
  await p.screenshot({ path: path.join(caps, 'vista-libre.png') });
  console.log('errores', err, tmp); await b.close();
})();
