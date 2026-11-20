// node juez/auto-largo.mjs <copia-de-salida> <carpeta-capturas>
// Deja correr la ruta guiada 4 minutos (cada parada son 8,5 s de escena más el vuelo; a ~3 fps con dt ≤ 0,05 son
// más de 90 s reales) y apunta en qué parada va cada minuto.
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [dir, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('file://' + path.resolve(dir, 'alhambra-ruta-3d.html'));
await p.waitForTimeout(5000);
await p.click('#btnStart');
const log = [];
for (let m = 1; m <= 4; m++) {
  await p.waitForTimeout(60000);
  log.push([`${m} min`, await p.textContent('#stopKicker'), await p.textContent('#stopName')]);
}
await p.screenshot({ path: out + '/auto-4min.png' });
console.log(JSON.stringify(log));
await b.close();
