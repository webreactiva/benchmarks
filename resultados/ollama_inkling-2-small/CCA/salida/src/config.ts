import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "./domain/pricing.js";

export interface AppConfig {
  port: number;
  host: string;
  pricing: PricingConfig;
  cartTtlMs: number | null;
}

function numFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const ttlDays = numFromEnv("CART_TTL_DAYS", 7);
  return {
    port: numFromEnv("PORT", 3000),
    host: env.HOST ?? "0.0.0.0",
    cartTtlMs: ttlDays > 0 ? ttlDays * 24 * 60 * 60 * 1000 : null,
    pricing: {
      taxRate: numFromEnv("TAX_RATE", DEFAULT_PRICING_CONFIG.taxRate),
      shippingFlatCents: numFromEnv("SHIPPING_FLAT_CENTS", DEFAULT_PRICING_CONFIG.shippingFlatCents),
      freeShippingThresholdCents: numFromEnv(
        "FREE_SHIPPING_THRESHOLD_CENTS",
        DEFAULT_PRICING_CONFIG.freeShippingThresholdCents,
      ),
      currency: env.CURRENCY ?? DEFAULT_PRICING_CONFIG.currency,
    },
  };
}
