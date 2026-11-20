import pino, { type Logger as PinoLogger } from 'pino';
import type { Logger } from '@cart/core';
import type { AppConfig } from '../config.js';

export function createLogger(config: AppConfig): Logger {
  const pinoLogger: PinoLogger = pino({
    level: config.logLevel,
    base: { service: 'cart-api', env: config.env },
    redact: {
      paths: ['req.headers.authorization', 'headers["x-customer-id"]'],
      remove: true,
    },
    ...(config.env === 'development' ? { transport: undefined } : {}),
  });

  const wrap = (logger: PinoLogger): Logger => ({
    debug: (message, meta) => logger.debug(meta ?? {}, message),
    info: (message, meta) => logger.info(meta ?? {}, message),
    warn: (message, meta) => logger.warn(meta ?? {}, message),
    error: (message, meta) => logger.error(meta ?? {}, message),
    child: (bindings) => wrap(logger.child(bindings)),
  });

  return wrap(pinoLogger);
}
