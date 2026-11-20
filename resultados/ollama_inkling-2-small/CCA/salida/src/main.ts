import { CartService } from "./application/cartService.js";
import { loadConfig } from "./config.js";
import { InMemoryCartRepository } from "./infrastructure/inMemoryCartRepository.js";
import { InMemoryCouponRepository, SEED_COUPONS } from "./infrastructure/inMemoryCouponRepository.js";
import { InMemoryEventBus } from "./infrastructure/inMemoryEventBus.js";
import { InMemoryProductCatalog, SEED_PRODUCTS } from "./infrastructure/inMemoryProductCatalog.js";
import { buildApp } from "./http/app.js";

const config = loadConfig();

const productCatalog = new InMemoryProductCatalog(SEED_PRODUCTS);
const cartService = new CartService(
  new InMemoryCartRepository(),
  productCatalog,
  new InMemoryCouponRepository(SEED_COUPONS),
  new InMemoryEventBus((event) => console.log(`[event] ${event.type}`, event.payload)),
  { pricing: config.pricing, cartTtlMs: config.cartTtlMs },
);

const app = buildApp({ cartService, productCatalog });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port: config.port, host: config.host });
  console.log(`Cart API listening on http://${config.host}:${config.port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
