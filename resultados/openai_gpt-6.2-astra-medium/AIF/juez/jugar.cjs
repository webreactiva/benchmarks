// node juez/jugar.cjs <copia de index.html> <captura>: clic en dos elementos del inventario (#list) y lee #msg y #count; recarga para ver si guarda
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(800);
  const mezcla = async (a, c) => {
    await p.click(`#list >> text="${a}"`); await p.click(`#list >> text="${c}"`); await p.waitForTimeout(700);
    const r = (await p.textContent('#count')).trim() + ' | ' + (await p.textContent('#msg')).trim();
    await p.click('#clear').catch(() => {}); await p.waitForTimeout(200); return r;
  };
  console.log(await mezcla('Código', 'Micrófono')); console.log(await mezcla('Código', 'Idea')); console.log(await mezcla('Comunidad', 'Comunidad')); console.log(await mezcla('Micrófono', 'Proyecto'));
  await p.screenshot({ path: process.argv[3] }); await p.reload(); await p.waitForTimeout(500); console.log('tras recargar:', (await p.textContent('#count')).trim());
  console.log('errores', err); await b.close();
})();
