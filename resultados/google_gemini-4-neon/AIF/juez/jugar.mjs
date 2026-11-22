// node juez/jugar.mjs <copia-de-salida> <carpeta-capturas>
// Juega arrastrando fichas en el tablero. Para cada mezcla limpia el tablero, saca las dos fichas del inventario
// con un clic y suelta una sobre la otra: Pantuflas + Código, Pantuflas + Podcast, Código + IA, Podcast + Podcast.
// Luego Dani Primo + Developer (sin receta) con el Modo Libre apagado y encendido, búsqueda, pista y recarga.
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [dir, out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + path.resolve(dir, 'index.html'));
await p.waitForTimeout(1500);
const tablero = () => p.locator('#workspace .board-item').allTextContents();
async function mezcla(a, c, foto) {
  await p.click('#btn-clear'); await p.waitForTimeout(400);
  for (const n of [a, c]) {
    await p.locator('#inventory-list .inv-chip').filter({ hasText: n }).first().click();
    await p.waitForTimeout(400);
  }
  const it = p.locator('#workspace .board-item');
  const A = await it.nth(0).boundingBox(), C = await it.nth(1).boundingBox();
  await p.mouse.move(A.x + A.width / 2, A.y + A.height / 2); await p.mouse.down();
  await p.mouse.move(C.x + C.width / 2, C.y + C.height / 2, { steps: 15 }); await p.mouse.up();
  await p.waitForTimeout(1000);
  if (foto) await p.screenshot({ path: `${out}/${foto}.png` });
  return [`${a} + ${c}`, (await tablero()).map(t => t.trim().replace(/\s+/g, ' '))];
}
const log = [];
log.push(await mezcla('Código', 'Pantuflas'));
log.push(await mezcla('Pantuflas', 'Podcast', 'dani-primo'));
log.push(await mezcla('Código', 'IA'));
log.push(await mezcla('Podcast', 'Podcast'));
log.push(await mezcla('Dani Primo', 'Developer', 'sin-receta-libre-apagado'));
await p.click('#btn-free'); await p.waitForTimeout(300);
log.push(await mezcla('Dani Primo', 'Developer', 'sin-receta-libre'));
await p.fill('#search-input', 'dani'); await p.waitForTimeout(400);
const busqueda = await p.locator('#inventory-list .inv-chip').allTextContents();
await p.fill('#search-input', '');
await p.click('#btn-hint'); await p.waitForTimeout(800);
await p.screenshot({ path: out + '/pista.png' });
const antes = await p.textContent('#progress-text');
await p.reload(); await p.waitForTimeout(1500);
const despues = await p.textContent('#progress-text');
await p.click('#btn-atlas'); await p.waitForTimeout(600);
await p.screenshot({ path: out + '/atlas.png' });
console.log(JSON.stringify({ log, busqueda, antes, despues, errores: errs }, null, 1));
await b.close();
