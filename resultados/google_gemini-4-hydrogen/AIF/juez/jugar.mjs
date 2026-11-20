// node juez/jugar.mjs <copia-de-salida> <carpeta-capturas>
// Juega arrastrando fichas en el lienzo. Para cada mezcla limpia la mesa, saca las dos fichas del inventario y
// arrastra una sobre la otra: Código + Web, Web + Podcast, IA + Podcast, Código + Código y una mezcla sin receta.
// Luego la búsqueda, una pista, el Atlas y una recarga para ver si guarda.
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
await p.keyboard.press('Escape');
const inventario = () => p.locator('#sidebar-list .sidebar-item').allTextContents();
const mesa = () => p.locator('.canvas-item').allTextContents();
async function mezcla(a, c, foto) {
  await p.click('#btn-clear'); await p.waitForTimeout(400);
  for (const n of [a, c]) {
    await p.locator('#sidebar-list .sidebar-item').filter({ hasText: new RegExp(`^\\S+\\s*${n}$`) }).first().click();
    await p.waitForTimeout(400);
  }
  const chips = p.locator('.canvas-item');
  const A = await chips.nth(0).boundingBox(), B = await chips.nth(1).boundingBox();
  await p.mouse.move(A.x + A.width / 2, A.y + A.height / 2);
  await p.mouse.down();
  await p.mouse.move(B.x + B.width / 2, B.y + B.height / 2, { steps: 15 });
  await p.mouse.up();
  await p.waitForTimeout(1000);
  if (foto) await p.screenshot({ path: `${out}/${foto}.png` });
  return [`${a} + ${c}`, await mesa()];
}
const log = [];
log.push(await mezcla('Código', 'Web'));
log.push(await mezcla('Web', 'Podcast', 'web-reactiva'));
log.push(await mezcla('IA', 'Podcast'));
log.push(await mezcla('Código', 'Código'));
// HTML + Robotito no tiene receta (comprobado con juez/alcanzables.js)
log.push(await mezcla('HTML', 'Robotito', 'sin-receta'));
await p.fill('#search-input', 'robo'); await p.waitForTimeout(400);
const busqueda = await inventario();
await p.fill('#search-input', '');
await p.click('#btn-hint'); await p.waitForTimeout(800);
await p.screenshot({ path: out + '/pista.png' });
const antes = (await inventario()).length;
await p.reload(); await p.waitForTimeout(1500);
const despues = (await inventario()).length;
await p.keyboard.press('Escape');
await p.click('#btn-atlas'); await p.waitForTimeout(600);
await p.screenshot({ path: out + '/atlas.png' });
console.log(JSON.stringify({ log, busqueda, inventario_antes: antes, inventario_tras_recarga: despues, errores: errs }, null, 1));
await b.close();
