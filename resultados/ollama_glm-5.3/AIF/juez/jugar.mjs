// node juez/jugar.mjs <copia-de-salida> <carpeta-capturas>
// Juega arrastrando fichas en el tablero. Para cada mezcla limpia el tablero, saca las dos fichas de la barra lateral
// y suelta una sobre la otra: Humano + Café, Prompt + Terminal, Café + Café, Developer + Script y una mezcla sin
// receta (modo infinito). Luego búsqueda, pista y recarga para ver si guarda.
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [dir, out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + path.resolve(dir, 'alquimia-reactiva.html'));
await p.waitForTimeout(1500);
for (const sel of ['#helpClose']) if (await p.locator(sel).isVisible()) await p.click(sel);
const tablero = () => p.locator('#board .node').allTextContents();
async function limpia() {
  await p.click('#clearBtn'); await p.waitForTimeout(300);
  if (await p.locator('#confirmOk').isVisible()) await p.click('#confirmOk');
  await p.waitForTimeout(300);
}
async function mezcla(a, c, foto) {
  await limpia();
  const board = await p.locator('#board').boundingBox();
  const puntos = [[board.x + board.width * 0.35, board.y + board.height * 0.5], [board.x + board.width * 0.65, board.y + board.height * 0.5]];
  for (const [i, n] of [a, c].entries()) {
    const it = p.locator('#items .item').filter({ hasText: new RegExp(`^\\S+\\s*${n}\\s*$`) }).first();
    const B = await it.boundingBox();
    await p.mouse.move(B.x + B.width / 2, B.y + B.height / 2); await p.mouse.down();
    await p.mouse.move(puntos[i][0], puntos[i][1], { steps: 12 }); await p.mouse.up();
    await p.waitForTimeout(300);
  }
  const nodes = p.locator('#board .node');
  const A = await nodes.nth(0).boundingBox(), C = await nodes.nth(1).boundingBox();
  await p.mouse.move(A.x + A.width / 2, A.y + A.height / 2); await p.mouse.down();
  await p.mouse.move(C.x + C.width / 2, C.y + C.height / 2, { steps: 15 }); await p.mouse.up();
  await p.waitForTimeout(1000);
  if (foto) await p.screenshot({ path: `${out}/${foto}.png` });
  return [`${a} + ${c}`, await tablero()];
}
const log = [];
log.push(await mezcla('Humano', 'Café'));
log.push(await mezcla('Prompt', 'Terminal'));
log.push(await mezcla('Café', 'Café', 'cafe-doble'));
log.push(await mezcla('Developer', 'Script'));
const sinReceta = await p.evaluate(() => { try { return !recipes.has(pairKey(norm('Humano'), norm('Script'))); } catch (e) { return 'no se pudo leer: ' + e.message; } });
log.push([...(await mezcla('Humano', 'Script', 'infinito')), 'sin receta: ' + sinReceta]);
await p.fill('#search', 'caf'); await p.waitForTimeout(400);
const busqueda = await p.locator('#items .item').allTextContents();
await p.fill('#search', '');
await p.click('#hintBtn'); await p.waitForTimeout(800);
await p.screenshot({ path: out + '/pista.png' });
const contador = async () => p.textContent('#count');
const antes = await contador();
await p.reload(); await p.waitForTimeout(1500);
const despues = await contador();
await p.click('#helpBtn'); await p.waitForTimeout(500);
await p.screenshot({ path: out + '/ayuda-retos.png' });
console.log(JSON.stringify({ log, busqueda, antes, despues, errores: errs }, null, 1));
await b.close();
