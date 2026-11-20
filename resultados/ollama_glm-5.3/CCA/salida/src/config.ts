import type { DiscountRule, PricingConfig } from './services/pricing-service.js';

export interface AppConfig {
  port: number;
  storage: 'sqlite' | 'memory';
  dbFile: string;
  pricing: PricingConfig;
}

function toInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const DEFAULT_DISCOUNTS: Record<string, DiscountRule> = {
  BIENVENIDA10: { code: 'BIENVENIDA10', type: 'percent', value: 10 },
  GASTA50: { code: 'GASTA50', type: 'percent', value: 5, minSubtotalCents: 5000 },
  CINCOEUROS: { code: 'CINCOEUROS', type: 'fixed', value: 500 },
};

/**
 * Configuración desde variables de entorno, con valores por defecto sensatos.
 * Cualquier valor no presente cae en el default: desplegar en otro entorno es
 * solo cuestión de variables, no de cambios de código.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const storage = env.STORAGE === 'memory' ? 'memory' : 'sqlite';

  let discounts = DEFAULT_DISCOUNTS;
  if (env.DISCOUNT_CODES?.trim()) {
    try {
      const parsed = JSON.parse(env.DISCOUNT_CODES) as Record<string, Omit<DiscountRule, 'code'>>;
      discounts = Object.fromEntries(
        Object.entries(parsed).map(([code, rule]) => [
          code.toUpperCase(),
          { ...rule, code: code.toUpperCase() },
        ]),
      );
    } catch {
      console.warn('[config] DISCOUNT_CODES no es JSON válido; se usan los códigos por defecto');
    }
  }

  return {
    port: toInt(env.PORT, 3000),
    storage,
    dbFile: env.DB_FILE ?? 'data/cart.db',
    pricing: {
      // Impuesto acotado a [0, 1] por si acaso alguien escribe "21" en lugar de "0.21".
      taxRate: Math.min(Math.max(toNumber(env.TAX_RATE, 0.21), 0), 1),
      shippingCents: toInt(env.SHIPPING_CENTS, 499),
      freeShippingThresholdCents: toInt(env.FREE_SHIPPING_THRESHOLD_CENTS, 5000),
      discounts,
    },
  };
}
