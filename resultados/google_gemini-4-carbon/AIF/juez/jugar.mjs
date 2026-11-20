// node juez/jugar.mjs <copia-de-salida> <carpeta-capturas>
// Juega arrastrando fichas en el lienzo. Para cada mezcla limpia la mesa, saca las dos fichas del inventario y
// arrastra una sobre la otra: Código + Café, Micrófono + Micrófono, Código + Código, Web + Podcast y una mezcla sin
// receta (modo infinito). Luego la búsqueda, una pista y una recarga para ver si guarda.
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
await p.waitForTimeout(2000);
const inventario = async () => p.locator('#inventory-list .chip .label').allTextContents();
async function mezcla(a, c, foto) {
  await p.click('#btn-clear'); await p.waitForTimeout(400);
  for (const n of [a, c]) {
    await p.locator('#inventory-list .chip').filter({ has: p.locator('.label', { hasText: new RegExp(`^${n}$`) }) }).first().click();
    await p.waitForTimeout(400);
  }
  const chips = p.locator('.canvas-chip');
  const A = await chips.nth(0).boundingBox(), B = await chips.nth(1).boundingBox();
  await p.mouse.move(A.x + A.width / 2, A.y + A.height / 2);
  await p.mouse.down();
  await p.mouse.move(B.x + B.width / 2, B.y + B.height / 2, { steps: 15 });
  await p.mouse.up();
  await p.waitForTimeout(1000);
  if (foto) await p.screenshot({ path: `${out}/${foto}.png` });
  return [`${a} + ${c}`, await p.locator('.canvas-chip .label').allTextContents()];
}
const log = [];
log.push(await mezcla('Código', 'Café'));
log.push(await mezcla('Micrófono', 'Micrófono'));
log.push(await mezcla('Código', 'Código'));
log.push(await mezcla('Web', 'Podcast', 'web-reactiva'));
const sinReceta = await p.evaluate(() => !RECIPE_MAP.has(pairKey('cafe', 'web')));
log.push(await mezcla('Programador', 'Web Reactiva'));
log.push([...(await mezcla('Café', 'Web', 'infinito')), 'sin receta oficial: ' + sinReceta]);
await p.fill('#search-input', 'pod'); await p.waitForTimeout(400);
const busqueda = await inventario();
await p.fill('#search-input', '');
await p.click('#btn-hint'); await p.waitForTimeout(800);
await p.screenshot({ path: out + '/pista.png' });
const contador = async () => (await p.textContent('body')).match(/Oficiales:\s*\d+\s*\/\s*\d+/)?.[0];
const antes = await contador();
await p.reload(); await p.waitForTimeout(1500);
const despues = await contador();
await p.click('#btn-codex'); await p.waitForTimeout(600);
await p.screenshot({ path: out + '/codice.png' });
console.log(JSON.stringify({ log, busqueda, antes, despues, inventario: await inventario(), errores: errs }, null, 1));
await b.close();
