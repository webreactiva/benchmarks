import { loadConfig } from './config.js';
import { createLogger } from './bootstrap.js';
import { EventConsumer, type ConsumerEvent } from './infrastructure/event-consumer.js';
import { createRedisClient } from './infrastructure/redis.js';

/**
 * Consumidor de eventos del carrito.
 *
 * Lee el stream de Redis con un grupo de consumidores: varios workers pueden
 * procesar en paralelo repartiendo los mensajes, y si uno cae, sus mensajes
 * pendientes se recuperan con XAUTOCLAIM. Esto permite escalar el
 * procesamiento de forma independiente de la API.
 */
const config = loadConfig();
const logger = createLogger(config);
// La lectura del stream es bloqueante: el timeout de comando debe superar
// el tiempo de bloqueo para que ioredis no aborte la lectura.
const redis = createRedisClient(config, 'worker', {
  commandTimeoutMs: config.worker.blockMs + 10_000,
  blockingTimeoutMs: config.worker.blockMs + 5_000,
});

const consumer = new EventConsumer(redis, {
  stream: 'events:cart',
  group: config.worker.consumerGroup,
  consumer: `${config.worker.consumerName}-${process.pid}`,
  batchSize: config.worker.batchSize,
  blockMs: config.worker.blockMs,
  minIdleMs: 30_000,
  keyPrefix: config.redis.keyPrefix,
});

let running = true;

function logEvent(event: ConsumerEvent): void {
  switch (event.type) {
    case 'cart.checked_out':
      logger.info(
        { cartId: event.cartId, version: event.version, payload: event.data },
        'pedido cerrado',
      );
      break;
    case 'cart.merged':
      logger.info(
        { cartId: event.cartId, payload: event.data },
        'carrito fusionado tras el login',
      );
      break;
    case 'cart.created':
    case 'cart.item_added':
    case 'cart.item_removed':
    case 'cart.item_updated':
    case 'cart.cleared':
    case 'cart.promo_applied':
    case 'cart.promo_removed':
      logger.debug({ type: event.type, cartId: event.cartId, payload: event.data }, 'evento de carrito');
      break;
    default:
      logger.warn({ type: event.type, cartId: event.cartId }, 'evento desconocido');
  }
}

async function handle(event: ConsumerEvent): Promise<void> {
  logEvent(event);
  await consumer.ack(event.id);
}

async function loop(): Promise<void> {
  while (running) {
    try {
      const reclaimed = await consumer.reclaimPending();
      for (const event of reclaimed) await handle(event);

      const events = await consumer.readBatch();
      for (const event of events) await handle(event);
    } catch (err) {
      if (!running) break;
      logger.error({ err }, 'error en el bucle del worker');
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
}

const created = await consumer.ensureGroup();
logger.info(
  {
    stream: 'events:cart',
    group: config.worker.consumerGroup,
    consumer: `${config.worker.consumerName}-${process.pid}`,
    created,
  },
  'worker iniciado',
);

const stop = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'apagando el worker');
  running = false;
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
  process.exit(0);
};

process.on('SIGTERM', () => void stop('SIGTERM'));
process.on('SIGINT', () => void stop('SIGINT'));

await loop();
