// node juez/jugar.mjs <copia-de-salida> <carpeta-capturas>
// Juega arrastrando: para cada mezcla limpia el tablero, saca la primera ficha con un clic en el inventario
// (queda en un sitio al azar del tablero) y arrastra la segunda desde el inventario hasta soltarla encima.
// Mezclas con receta, una sin receta (lo que dice el aviso), búsqueda, pista y recarga (progreso guardado).
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
await p.goto('file://' + path.resolve(dir, 'alquimia-reactiva.html'));
await p.waitForTimeout(1000);
const ficha = n => p.locator('#inv .chip').filter({ has: p.locator('b') }).filter({ hasText: new RegExp(`^\\S+${n}$`) }).first();
const tablero = async () => (await p.locator('#layer .chip').allTextContents()).map(t => t.trim());
async function mezcla(a, c, foto) {
  await p.click('#clear'); await p.waitForTimeout(200);
  await ficha(a).click(); await p.waitForTimeout(400);
  const A = await p.locator('#layer .chip').first().boundingBox();
  const C = await ficha(c).boundingBox();
  await p.mouse.move(C.x + C.width / 2, C.y + C.height / 2); await p.mouse.down();
  await p.mouse.move(A.x + A.width / 2, A.y + A.height / 2, { steps: 15 }); await p.mouse.up();
  await p.waitForTimeout(700);
  const aviso = (await p.textContent('#toast')).trim();
  if (foto) await p.screenshot({ path: `${out}/${foto}.png` });
  return [`${a} + ${c}`, await tablero(), aviso];
}
const log = [];
log.push(await mezcla('HTML', 'CSS', 'mezcla'));
log.push(await mezcla('JavaScript', 'Servidor'));
log.push(await mezcla('CSS', 'CSS'));
log.push(await mezcla('Micrófono', 'Café'));
log.push(await mezcla('Café', 'Servidor'));
log.push(await mezcla('Podcast', 'Página web'));       // receta de Web Reactiva
log.push(await mezcla('Node.js', 'Flexbox', 'sin-receta'));
await p.fill('#search', 'web'); await p.waitForTimeout(300);
const busqueda = (await p.locator('#inv .chip').allTextContents()).map(t => t.trim());
await p.fill('#search', ''); await p.dispatchEvent('#search', 'input');
await p.click('#hint'); await p.waitForTimeout(400);
const pista = (await p.textContent('#toast')).trim();
await p.screenshot({ path: out + '/pista.png' });
const antes = await p.textContent('#num');
await p.reload(); await p.waitForTimeout(1000);
const despues = await p.textContent('#num');
console.log(JSON.stringify({ log, busqueda, pista, antes, despues, errores: errs }, null, 1));
await b.close();
