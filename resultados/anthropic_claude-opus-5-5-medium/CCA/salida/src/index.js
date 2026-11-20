// Punto de entrada.
//   PORT=3000            puerto HTTP
//   REDIS_URL=redis://…  usa Redis como almacén compartido (requiere `npm i ioredis`)
//   CLUSTER=1            un worker por CPU (solo tiene sentido con REDIS_URL;
//                        con memoria cada worker tendría su propio estado)
//   LOG_REQUESTS=1       log de cada petición

import cluster from 'node:cluster';
import os from 'node:os';
import { buildContainer } from './container.js';
import { createServer } from './http/server.js';

const port = Number(process.env.PORT ?? 3000);

if (process.env.CLUSTER && cluster.isPrimary) {
  if (!process.env.REDIS_URL) {
    console.warn('⚠ CLUSTER sin REDIS_URL: cada worker tendrá carritos distintos en memoria.');
  }
  const workers = Number(process.env.WORKERS ?? os.availableParallelism());
  console.log(`Arrancando ${workers} workers…`);
  for (let i = 0; i < workers; i++) cluster.fork();
  cluster.on('exit', (w, code) => {
    console.error(`Worker ${w.process.pid} terminó (${code}); relanzando`);
    cluster.fork();
  });
} else {
  const deps = await buildContainer();
  const server = createServer(deps);
  server.listen(port, () => {
    const store = process.env.REDIS_URL ? 'Redis' : 'memoria';
    console.log(`Carrito escuchando en http://localhost:${port} (pid ${process.pid}, almacén: ${store})`);
  });

  // Apagado ordenado: deja terminar las peticiones en curso.
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    });
  }
}
