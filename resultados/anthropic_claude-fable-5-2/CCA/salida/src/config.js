const int = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Valor de configuración no válido: ${value}`);
  return n;
};

export function loadConfig(env = process.env) {
  return {
    port: int(env.PORT, 3000),
    redisUrl: env.REDIS_URL || null,
    limits: {
      maxLines: int(env.CART_MAX_LINES, 100),
      maxQuantityPerLine: int(env.CART_MAX_QTY_PER_LINE, 99),
      cartTtlSeconds: int(env.CART_TTL_SECONDS, 60 * 60 * 24 * 30),
      idempotencyTtlSeconds: int(env.IDEMPOTENCY_TTL_SECONDS, 60 * 60 * 24),
    },
  };
}

export const defaultLimits = loadConfig({}).limits;
