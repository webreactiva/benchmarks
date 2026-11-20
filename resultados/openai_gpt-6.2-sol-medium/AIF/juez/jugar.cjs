// node juez/jugar.cjs <copia de index.html> <captura>: recarga entre mezclas (la mesa enseña el resultado y tapa las ranuras).: arrastra Código y Curiosidad a la mesa, combina; luego Café + Código; luego una mezcla sin receta
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(1500);
  const mezcla = async (a, c) => {
    await p.dragAndDrop(`[data-item="${a}"]`, '.slot[data-slot="0"]'); await p.dragAndDrop(`[data-item="${c}"]`, '.slot[data-slot="1"]');
    await p.click('#mix'); await p.waitForTimeout(1200); const r = (await p.textContent('#progress-number')) + ' | ' + ((await p.textContent('#status')) || '').trim().slice(0, 90) + ' | ' + ((await p.textContent('#result').catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    await p.screenshot({ path: process.argv[3] }); await p.reload(); await p.waitForTimeout(1000); return r;
  };
  console.log('código+curiosidad:', await mezcla('codigo', 'curiosidad'));
  console.log('café+código:', await mezcla('cafe', 'codigo'));
  console.log('café+café:', await mezcla('cafe', 'cafe'));
  await p.screenshot({ path: process.argv[3] });
  await p.reload(); await p.waitForTimeout(1000); console.log('tras recargar:', await p.textContent('#progress-number'));
  console.log('errores', err); await b.close();
})();
