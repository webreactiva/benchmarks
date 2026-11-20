// node juez/barrido.cjs — mueve el deslizador de progreso por toda la ruta en vista Paseo y hace una captura cada 10 % (en el temporal), para ver si la cámara atraviesa muros.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const dir = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a3d-sonnet-')); const copia = path.join(tmp, 'a.html');
fs.copyFileSync(path.join(dir, 'salida', 'alhambra_ruta_3d.html'), copia);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('file://' + copia); await p.waitForTimeout(4000);
  await p.click('#go'); await p.waitForTimeout(1000); await p.click('#play');
  for (let v = 50; v <= 950; v += 100) {
    await p.evaluate(v => { const r = document.getElementById('prog'); r.value = v; r.dispatchEvent(new Event('input')); }, v);
    await p.waitForTimeout(2500); await p.screenshot({ path: path.join(tmp, `u${v}.png`) });
  }
  console.log(tmp); await b.close();
})();
