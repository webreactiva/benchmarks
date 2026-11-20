import { loadConfig } from './config.js';
import { createRuntime } from './bootstrap.js';

const config = loadConfig();
const runtime = await createRuntime(config);

await runtime.app.listen({ port: config.port, host: config.host });

let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  runtime.logger.info({ signal }, 'apagando el servicio');
  try {
    await runtime.close();
  } catch (err) {
    runtime.logger.error({ err }, 'error durante el apagado');
  }
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  runtime.logger.error({ err }, 'promesa no gestionada');
});
