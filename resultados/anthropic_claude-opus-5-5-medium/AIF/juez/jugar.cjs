// node juez/jugar.cjs <copia del html> <carpeta de capturas>: arrastra con el ratón, como una persona, desde la lista al tablero y una ficha sobre otra
const { chromium } = require('playwright');
(async () => {
  const [html, caps] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const err = []; p.on('pageerror', e => err.push(e.message)); p.on('console', m => m.type() === 'error' && err.push(m.text()));
  await p.goto('file://' + html); await p.waitForTimeout(800);
  await p.screenshot({ path: caps + '/inicio.png' }); await p.click('#clearBtn'); // el juego arranca con los cuatro básicos en el tablero: se limpia para soltar en hueco
  const centro = async loc => { const r = await loc.boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
  const arrastra = async (desde, [x, y]) => { const [sx, sy] = await centro(desde);
    await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(sx - 20, sy, { steps: 4 }); await p.mouse.move(x, y, { steps: 15 }); await p.mouse.up(); await p.waitForTimeout(400); };
  const deLista = n => p.locator(`#list .item[data-name="${n}"]`);
  const enMesa = n => p.locator(`#board .inst[data-name="${n}"]`).last();
  const avisos = async () => (await p.locator('#toasts .toast').allTextContents()).slice(-1)[0];
  const mezcla = async (a, c, pos) => { await arrastra(deLista(a), pos); await arrastra(deLista(c), await centro(enMesa(a)));
    return (await avisos()) + ' | ' + (await p.textContent('#count')) + '/' + (await p.textContent('#total')); };
  console.log('Código + Café:', await mezcla('Código', 'Café', [300, 300]));
  await p.screenshot({ path: caps + '/codigo-cafe.png' });
  console.log('Idea + Bug:', await mezcla('Idea', 'Bug', [550, 500]));
  console.log('Programador + Feature (mesa):', await (async () => { await arrastra(enMesa('Feature'), await centro(enMesa('Programador'))); return avisos(); })());
  await p.waitForTimeout(150); await p.screenshot({ path: caps + '/sin-receta.png' });
  console.log('Código + Código:', await mezcla('Código', 'Código', [300, 550]));
  await p.click('#hintBtn'); await p.waitForTimeout(300);
  console.log('pista:', await avisos(), '| resaltado en la lista:', await p.locator('#list .item.hint').allTextContents());
  await p.screenshot({ path: caps + '/pista.png' });
  await p.fill('#search', 'pro'); await p.waitForTimeout(200);
  console.log('buscar «pro»:', await p.locator('#list .item').allTextContents());
  await p.fill('#search', '');
  await p.reload(); await p.waitForTimeout(800);
  console.log('tras recargar:', await p.textContent('#count'), '| fichas en el tablero', await p.locator('#board .inst').count());
  console.log('errores', err); await b.close();
})();
