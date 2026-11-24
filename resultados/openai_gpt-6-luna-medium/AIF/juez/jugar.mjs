// NODE_PATH=<node_modules con playwright> node juez/jugar.mjs <carpeta AIF>
// Juega en la mesa limpia: suelta Web sobre Código, luego DOM sobre Estado, y una pareja sin receta (Web + Evento).
import { createRequire } from 'node:module';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const dir = path.resolve(process.argv[2]);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errores = []; p.on('pageerror', e => errores.push(e.message));
await p.goto('file://' + path.join(dir, 'salida/index.html')); await p.waitForTimeout(800);
const saca = async nombre => { await p.click(`.invitem:has(strong:text-is("${nombre}"))`); await p.waitForTimeout(200); };
const fichas = () => p.$$eval('#board .tile', ts => ts.map(t => t.querySelector('.name').textContent));
const suelta = async (a, b2) => {  // arrastra la ficha a encima de la b
  const ta = p.locator(`#board .tile:has(.name:text-is("${a}"))`).first(), tb = p.locator(`#board .tile:has(.name:text-is("${b2}"))`).first();
  const ra = await ta.boundingBox(), rb = await tb.boundingBox();
  await p.mouse.move(ra.x + ra.width / 2, ra.y + ra.height / 2); await p.mouse.down();
  await p.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(500);
};
const out = {};
await saca('Web'); await saca('Código'); await suelta('Web', 'Código'); out.web_codigo = await fichas();
await saca('Estado'); await suelta('DOM', 'Estado'); out.dom_estado = await fichas();
await saca('Web'); await saca('Evento'); await suelta('Web', 'Evento'); out.web_evento = await fichas();
out.aviso = await p.textContent('#toast');
out.coleccion = await p.$$eval('.invitem strong', s => s.map(x => x.textContent));
await p.screenshot({ path: path.join(dir, 'capturas/juez-jugar.png') });
console.log(JSON.stringify({ errores, ...out }, null, 1));
await b.close();
