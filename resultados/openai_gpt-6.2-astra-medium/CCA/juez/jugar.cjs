// node juez/jugar.cjs <copia de salida> <captura>: abre index.html, +1, −1, guardar para después, quitar, recarga; y un localStorage manipulado
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('file://' + process.argv[2] + '/index.html'); await p.waitForTimeout(600);
  const tot = async () => (await p.evaluate(() => document.body.innerText.match(/Total[^\n]*\n?[^\n]*€/)?.[0] || '?')).replace(/\s+/g, ' ');
  const clic = async (sel, nombre) => { const n = await p.locator(sel).count(); if (n) { await p.locator(sel).first().click(); await p.waitForTimeout(300); } console.log(nombre, n ? await tot() : '(no hay ' + sel + ')'); };
  console.log('inicio:', await tot());
  await clic('[aria-label*="Aumentar"], [aria-label*="Añadir una"], button:has-text("+")', '+1:');
  await clic('[aria-label*="Reducir"], [aria-label*="Restar"], button:has-text("−")', '−1:');
  await clic('button:has-text("Guardar")', 'guardar para después:');
  await clic('[aria-label*="liminar"], button:has-text("Eliminar")', 'quitar:');
  await p.reload(); await p.waitForTimeout(400); console.log('tras recargar:', await tot());
  await p.evaluate(() => localStorage.setItem('origen.cart.v1', JSON.stringify({ items: { colombia: 1e9, v60: -3, taza: 1.5, '../x': 2 }, saved: ['nada'], price: 1 })));
  await p.reload(); await p.waitForTimeout(400); console.log('localStorage manipulado:', await tot());
  await p.screenshot({ path: process.argv[3], fullPage: true }); console.log('errores', err); await b.close();
})();
