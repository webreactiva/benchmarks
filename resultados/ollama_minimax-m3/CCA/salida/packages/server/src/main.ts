import { loadConfig } from './config.js';
import { createContainer } from './container.js';
import { buildApp } from './app.js';

const main = async (): Promise<void> => {
  const config = loadConfig();
  const container = await createContainer(config);
  const app = await buildApp(container);

  await app.listen({ port: config.port, host: config.host });
  container.logger.info('cart api listening', {
    host: config.host,
    port: config.port,
    env: config.env,
    storage: config.redis.url ? 'redis' : 'memory',
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    container.logger.info('shutting down', { signal });

    const forceExit = setTimeout(() => {
      container.logger.error('graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, config.shutdownTimeoutMs);
    forceExit.unref();

    try {
      await app.close();
    } catch (error) {
      container.logger.error('error while closing the server', { error: String(error) });
    }
    clearTimeout(forceExit);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    container.logger.error('unhandled rejection', { reason: String(reason) });
  });
};

main().catch((error: unknown) => {
  console.error('fatal error while starting the server', error);
  process.exit(1);
});
