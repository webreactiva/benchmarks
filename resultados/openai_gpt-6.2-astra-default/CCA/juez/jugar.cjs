// node juez/jugar.cjs <copia de salida> <captura>: abre index.html, suma, resta, quita, recarga; y un localStorage con precio y cantidades falsas
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const err = []; p.on('pageerror', e => err.push(e.message));
  const u = 'file://' + process.argv[2] + '/index.html'; await p.goto(u); await p.waitForTimeout(500);
  const tot = async () => (await p.textContent('.total')).replace(/\s+/g, ' ');
  console.log('inicio:', await tot());
  await p.click('[data-action="plus"][data-id="alpes"]'); console.log('+1 alpes:', await tot());
  await p.click('[data-action="remove"][data-id="bosque"]'); console.log('quita bosque:', await tot());
  await p.reload(); console.log('tras recargar:', await tot());
  await p.evaluate(() => localStorage.setItem('forma-estudio.cart.v1', JSON.stringify({ alpes: 1e9, lago: -3, valle: 1.5, '../x': 2, price: 1 })));
  await p.reload(); console.log('localStorage manipulado:', await tot(), await p.evaluate(() => localStorage.getItem('forma-estudio.cart.v1')));
  await p.screenshot({ path: process.argv[3], fullPage: true }); console.log('errores', err); await b.close();
})();
