import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';

const publicDir = fileURLToPath(new URL('./public', import.meta.url));
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(publicDir, path === '/' ? 'index.html' : '.' + path);
    if (!file.startsWith(publicDir + sep)) {
      response.writeHead(404).end();
      return;
    }

    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream',
      'Content-Length': body.length,
      'X-Content-Type-Options': 'nosniff',
    }).end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    const notFound = ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code);
    const status = error instanceof URIError ? 400 : notFound ? 404 : 500;
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end();
  }
});

const port = process.env.PORT ?? 3000;
server.listen(port, () => console.log(`Savia disponible en http://localhost:${server.address().port}`));
