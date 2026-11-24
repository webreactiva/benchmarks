// NODE_PATH=<node_modules con playwright> node juez/jugar.mjs <copia de salida> <captura>
// Sirve la copia con un servidor estático (usa módulos ES), añade, suma, quita, recarga, y prueba un localStorage
// manipulado (cantidades enormes, negativas, decimales, id con «../»).
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = path.resolve(process.argv[2]);
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => {
  const f = path.join(raiz, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(raiz) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0);
const url = `http://127.0.0.1:${srv.address().port}/`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const err = []; p.on('pageerror', e => err.push(e.message));
await p.goto(url); await p.waitForTimeout(800);
const estado = () => p.evaluate(() => ({ cuenta: document.querySelector('#cart-count')?.textContent, pie: document.querySelector('#drawer-footer')?.innerText.replace(/\s+/g, ' ').slice(0, 120), guardado: localStorage.getItem('nido-cart-v1') }));
const out = {};
await p.click('[data-add="jarron-arcilla"]'); await p.click('[data-add="jarron-arcilla"]'); await p.click('[data-add="taza-origen"]');
out.tres_altas = await estado();
await p.$eval('[data-remove="taza-origen"]', e => e.click()); out.quita_taza = await estado();
await p.reload(); await p.waitForTimeout(500); out.tras_recargar = await estado();
await p.evaluate(() => localStorage.setItem('nido-cart-v1', JSON.stringify({ 'jarron-arcilla': 1e9, 'taza-origen': -3, 'vela-pausa': 1.5, '../x': 2 })));
await p.reload(); await p.waitForTimeout(500); out.localStorage_manipulado = await estado();
await p.click('#open-cart').catch(() => {}); await p.waitForTimeout(400);
await p.screenshot({ path: process.argv[3] });
console.log(JSON.stringify({ errores: err, ...out }, null, 1));
await b.close(); srv.close();
