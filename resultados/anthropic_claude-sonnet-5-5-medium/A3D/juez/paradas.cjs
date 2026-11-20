// node juez/paradas.cjs [carpeta-destino] — salta a cada parada desde la lista (vista Paseo) y la captura tras 8 s.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const dir = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a3d-sonnet-')); const copia = path.join(tmp, 'a.html');
fs.copyFileSync(path.join(dir, 'salida', 'alhambra_ruta_3d.html'), copia);
const out = process.argv[2] || tmp;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('file://' + copia); await p.waitForTimeout(4000);
  const n = await p.locator('#stops button').count();
  for (let i = 0; i < n; i++) { await p.locator('#stops button').nth(i).click(); await p.waitForTimeout(8000);
    await p.screenshot({ path: path.join(out, `p${i + 1}.png`) }); }
  console.log(out); await b.close();
})();
