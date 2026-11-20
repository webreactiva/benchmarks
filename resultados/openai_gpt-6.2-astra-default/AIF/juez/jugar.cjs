// node juez/jugar.cjs <copia de index.html> <captura>: Código + Idea, IA + Código, Código + IA… y una mezcla sin receta; recarga para ver si guarda
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(800);
  const mezcla = async (a, c) => {
    await p.evaluate(() => document.querySelectorAll('.slot').forEach(s => s.click()));
    await p.dragAndDrop(`.card:has-text("${a}")`, '.slot >> nth=0'); await p.dragAndDrop(`.card:has-text("${c}")`, '.slot >> nth=1');
    await p.click('#mix'); await p.waitForTimeout(300); return (await p.textContent('#count')) + ' | ' + await p.textContent('#message');
  };
  console.log(await mezcla('Código', 'Idea')); console.log(await mezcla('IA', 'Código')); console.log(await mezcla('Comunidad', 'IA')); console.log(await mezcla('Proyecto', 'Copilot'));
  await p.screenshot({ path: process.argv[3] }); await p.reload(); await p.waitForTimeout(500); console.log('tras recargar:', await p.textContent('#count'));
  console.log('errores', err); await b.close();
})();
