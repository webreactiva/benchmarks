// node juez/paradas.mjs <copia-de-salida> <carpeta-capturas>
// Cada parada con su enlace propio (#p=N, que la página admite y coloca la cámara sin vuelo), espera a que
// se asiente el render y la captura. Al final, la vista de noche de los Leones.
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [dir, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const res = {};
const errs = [];
for (const [n, luz] of [[1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [6, 'noche']]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(dir, 'alhambra-ruta-3d.html') + `#p=${n}` + (luz ? `&luz=${luz}` : ''));
  await p.waitForTimeout(9000);
  const nombre = `parada-${n}${luz ? '-' + luz : ''}`;
  res[nombre] = await p.textContent('#ct');
  await p.screenshot({ path: `${out}/${nombre}.png` });
  await p.close();
}
res.errores = errs;
console.log(JSON.stringify(res, null, 1));
await b.close();
