// node jugar-a3d.mjs <carpeta-resultado> [selector-siguiente] [selector-auto]
// Capturas de un A3D: al cargar, tras pulsar «siguiente» 4 veces, y a 10 y 30 s de recorrido automático.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path';
const dir = path.resolve(process.argv[2]); const sig = process.argv[3]; const auto = process.argv[4];
const html = fs.readdirSync(path.join(dir, 'salida')).find(f => f.endsWith('.html'));
const caps = path.join(dir, 'capturas'); fs.mkdirSync(caps, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const err = []; p.on('pageerror', e => err.push(e.message)); p.on('console', m => { if (m.type() === 'error') err.push(m.text()); });
await p.goto('file://' + path.join(dir, 'salida', html)); await p.waitForTimeout(6000);
await p.screenshot({ path: path.join(caps, 'inicio.png') });
if (sig) { for (let i = 0; i < 4; i++) { await p.click(sig).catch(e => err.push('clic ' + e.message.slice(0, 60))); await p.waitForTimeout(2500); }
  await p.screenshot({ path: path.join(caps, 'siguiente-x4.png') }); }
if (auto) { await p.click(auto).catch(e => err.push('clic ' + e.message.slice(0, 60))); await p.waitForTimeout(10000);
  await p.screenshot({ path: path.join(caps, 'auto-10s.png') }); await p.waitForTimeout(20000); await p.screenshot({ path: path.join(caps, 'auto-30s.png') }); }
console.log('errores', err); await b.close();
