// NODE_PATH=<node_modules con playwright> node juez/recorrido.mjs <carpeta A3D>
// Pulsa «Iniciar recorrido», espera 10 s y captura; luego «Siguiente parada» dos veces y captura. Compara los píxeles
// del canvas para saber si la cámara se mueve sola o solo cambia el resaltado de la parada.
import { createRequire } from 'node:module';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const dir = path.resolve(process.argv[2]);
const url = 'file://' + path.join(dir, 'salida/ruta-alhambra-3d.html');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errores = [];
p.on('pageerror', e => errores.push(e.message));
await p.goto(url); await p.waitForTimeout(1500);
const lienzo = () => p.evaluate(() => document.querySelector('#scene').toDataURL().length);
const antes = await lienzo();
await p.click('#start'); await p.waitForTimeout(10000);
await p.screenshot({ path: path.join(dir, 'capturas/juez-10s.png') });
const a10 = await lienzo();
await p.click('#next'); await p.waitForTimeout(1500); await p.click('#next'); await p.waitForTimeout(3000);
await p.screenshot({ path: path.join(dir, 'capturas/juez-parada3.png') });
const a3 = await lienzo();
console.log(JSON.stringify({ errores, lienzo_inicio: antes, lienzo_10s: a10, lienzo_parada3: a3 }));
await b.close();
