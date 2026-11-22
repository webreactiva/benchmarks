import http from 'node:http';
import Redis from 'ioredis';
import { createApp } from './app.js';
import { CartService } from './cartService.js';
import { sampleCatalog } from './catalog.js';
import { loadConfig } from './config.js';
import { MemoryCartStore } from './stores/memoryStore.js';
import { RedisCartStore } from './stores/redisStore.js';

const config = loadConfig();

let store;
if (config.redisUrl) {
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 2 });
  redis.on('error', (err) => console.error('Redis:', err.message));
  store = new RedisCartStore(redis, config.limits);
} else {
  console.warn('REDIS_URL no definida: se usa el almacén en memoria (solo para desarrollo).');
  store = new MemoryCartStore(config.limits);
}

const service = new CartService({ store, catalog: sampleCatalog(), limits: config.limits });
const server = http.createServer(createApp({ service, store }));

server.listen(config.port, () => console.log(`Carrito escuchando en el puerto ${config.port}`));

// Apagado ordenado: deja terminar las peticiones en curso antes de salir.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(async () => {
      await store.close();
      process.exit(0);
    });
    server.closeIdleConnections();
  });
}
