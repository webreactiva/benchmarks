// node vistas.mjs <copia-de-salida> <carpeta-capturas>
// Vista final de cada parada: el vuelo de cámara dura 1,55 s de reloj de la escena, que a 1,3 fps (render por
// software) son ~25 s reales, así que se espera a que termine (camAnim no es global: se espera 30 s).
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [dir, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('file://' + path.resolve(dir, 'alhambra-ruta-3d.html'));
await p.waitForTimeout(4000);
const pills = await p.$$('#stops-strip button');
for (const i of [1, 3, 4, 5, 6]) {
  await pills[i].click();
  await p.waitForTimeout(30000);
  await p.screenshot({ path: `${out}/vista-parada-${i + 1}.png` });
}
await p.click('[data-light="day"]');
await p.click('#btn-overview');
await p.waitForTimeout(35000);
await p.screenshot({ path: `${out}/vista-aerea-dia.png` });
await b.close();
