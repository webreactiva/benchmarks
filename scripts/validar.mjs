// node validar.mjs <carpeta-resultado>
// Comprueba lo que dejó el modelo sin tocarlo: abre cada .html en Chromium (errores de consola y de página,
// captura a los 4 s) y renderiza cada diagrama Mermaid (.mmd o bloque ```mermaid de un .md) con mermaid@11.
// Escribe validacion.json y capturas en <carpeta>/capturas/.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2]);
const salida = path.join(dir, 'salida');
const caps = path.join(dir, 'capturas');
fs.mkdirSync(caps, { recursive: true });
const todos = [];
(function rec(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, f.name);
  if (f.isDirectory()) { if (f.name !== 'node_modules' && !f.name.startsWith('.')) rec(p); } else todos.push(p);
} })(salida);

const browser = await chromium.launch();
const res = { html: [], mermaid: [] };

for (const f of todos.filter(f => f.endsWith('.html'))) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errores = [];
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => errores.push('pageerror: ' + String(e.message).slice(0, 300)));
  try { await page.goto('file://' + f, { waitUntil: 'load', timeout: 20000 }); } catch (e) { errores.push('carga: ' + e.message.slice(0, 200)); }
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => ({
    titulo: document.title, canvas: document.querySelectorAll('canvas').length,
    texto: document.body ? document.body.innerText.slice(0, 400) : '',
    scripts: [...document.scripts].map(s => s.src).filter(Boolean),
  })).catch(() => ({}));
  const png = path.join(caps, path.relative(salida, f).replace(/[\/]/g, '_') + '.png');
  await page.screenshot({ path: png });
  res.html.push({ fichero: path.relative(salida, f), errores, ...info, captura: path.relative(dir, png) });
  await page.close();
}

const diagramas = [];
for (const f of todos) {
  const t = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.mmd') || f.endsWith('.mermaid')) diagramas.push([f, 0, t]);
  else if (f.endsWith('.md')) [...t.matchAll(/```mermaid\n([\s\S]*?)```/g)].forEach((m, i) => diagramas.push([f, i, m[1]]));
}
if (diagramas.length) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.setContent('<div id="d"></div>');
  await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js' });
  for (const [f, i, codigo] of diagramas) {
    const r = await page.evaluate(async c => {
      mermaid.initialize({ startOnLoad: false });
      try { const { svg } = await mermaid.render('m' + Math.random().toString(36).slice(2), c);
        document.getElementById('d').innerHTML = svg; return { ok: true }; }
      catch (e) { return { ok: false, error: String(e.message || e).slice(0, 400) }; }
    }, codigo);
    const png = path.join(caps, path.relative(salida, f).replace(/[\/]/g, '_') + `-${i}.png`);
    if (r.ok) await page.locator('#d svg').screenshot({ path: png });
    res.mermaid.push({ fichero: path.relative(salida, f), bloque: i, lineas: codigo.split('\n').length, ...r,
      captura: r.ok ? path.relative(dir, png) : null });
  }
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(dir, 'validacion.json'), JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 1).slice(0, 1500));
