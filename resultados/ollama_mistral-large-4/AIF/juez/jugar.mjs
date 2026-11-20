// node juez/jugar.mjs <copia-de-salida> <carpeta-capturas>
// Este juego combina seleccionando dos fichas del lienzo (clic en una y clic en otra). Para cada mezcla limpia el
// lienzo, saca las dos fichas con un clic en la lista y las combina. Prueba también arrastrar una sobre otra,
// una mezcla sin receta, búsqueda, pista y recarga.
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [dir, out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('dialog', d => d.accept());
await p.goto('file://' + path.resolve(dir, 'reactiva-craft.html'));
await p.waitForTimeout(1500);
const lienzo = () => p.locator('#canvas .chip').allTextContents();
async function saca(n) {
  await p.locator('#list > *').filter({ hasText: new RegExp(`^\\S*\\s*${n}\\s*$`) }).first().click();
  await p.waitForTimeout(300);
}
async function mezcla(a, c, foto) {
  await p.click('#btnClear'); await p.waitForTimeout(300);
  await saca(a); await saca(c);
  const chips = p.locator('#canvas .chip');
  await chips.nth(0).click(); await p.waitForTimeout(200);
  await chips.nth(1).click(); await p.waitForTimeout(900);
  if (foto) await p.screenshot({ path: `${out}/${foto}.png` });
  return [`${a} + ${c}`, await lienzo()];
}
const log = [];
log.push(await mezcla('Computadora', 'Internet'));
log.push(await mezcla('Papel', 'Internet'));
log.push(await mezcla('Computadora', 'Electricidad', 'mezcla'));
// Arrastrar una sobre otra
await p.click('#btnClear'); await saca('Papel'); await saca('Papel');
const ch = p.locator('#canvas .chip');
const A = await ch.nth(0).boundingBox(), C = await ch.nth(1).boundingBox();
await p.mouse.move(A.x + A.width / 2, A.y + A.height / 2); await p.mouse.down();
await p.mouse.move(C.x + C.width / 2, C.y + C.height / 2, { steps: 12 }); await p.mouse.up();
await p.waitForTimeout(900);
log.push(['arrastrar Papel sobre Papel', await lienzo()]);
log.push(await mezcla('Papel', 'Electricidad', 'sin-receta'));
await p.fill('#search', 'pod'); await p.waitForTimeout(300);
const busqueda = await p.locator('#list > *').allTextContents();
await p.fill('#search', '');
await p.click('#btnHint'); await p.waitForTimeout(600);
await p.screenshot({ path: out + '/pista.png' });
const antes = await p.textContent('#stat');
await p.reload(); await p.waitForTimeout(1500);
const despues = await p.textContent('#stat');
console.log(JSON.stringify({ log, busqueda, antes, despues, errores: errs }, null, 1));
await b.close();
