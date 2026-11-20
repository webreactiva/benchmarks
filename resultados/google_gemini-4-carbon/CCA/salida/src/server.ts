import { createServer, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';
import { CartService } from './application/cart-service.ts';
import { PricingEngine } from './domain/pricing.ts';
import {
  DEFAULT_COUPONS,
  InMemoryCatalogInventory,
} from './infrastructure/catalog/in-memory-catalog-inventory.ts';
import { InMemoryEventBus } from './infrastructure/events/in-memory-event-bus.ts';
import { InMemoryIdempotencyStore } from './infrastructure/idempotency/in-memory-idempotency-store.ts';
import { InMemoryCartRepository } from './infrastructure/persistence/in-memory-cart-repository.ts';
import { SqliteCartRepository } from './infrastructure/persistence/sqlite-cart-repository.ts';
import { TieredCartRepository } from './infrastructure/persistence/tiered-cart-repository.ts';
import { createHttpHandler } from './interfaces/http/router.ts';

export interface AppConfig {
  sqlitePath?: string;
  l1MaxEntries?: number;
  purgeIntervalMs?: number;
}

export interface ShoppingCartApp {
  readonly server: Server;
  readonly cartService: CartService;
  readonly catalogInventory: InMemoryCatalogInventory;
  readonly pricingEngine: PricingEngine;
  readonly eventBus: InMemoryEventBus;
  readonly l1Cache: InMemoryCartRepository;
  readonly sqliteRepo: SqliteCartRepository;
  readonly cartRepository: TieredCartRepository;
  close(): Promise<void>;
}

export function createShoppingCartApp(config: AppConfig = {}): ShoppingCartApp {
  const sqlitePath = config.sqlitePath ?? process.env.CART_DB_PATH ?? './data/carts.sqlite';
  const l1Cache = new InMemoryCartRepository({
    maxEntries: config.l1MaxEntries ?? 5_000,
  });
  const sqliteRepo = new SqliteCartRepository(sqlitePath);
  const cartRepository = new TieredCartRepository(l1Cache, sqliteRepo);

  const catalogInventory = new InMemoryCatalogInventory();
  const pricingEngine = new PricingEngine(DEFAULT_COUPONS);
  const eventBus = new InMemoryEventBus();
  const idempotencyStore = new InMemoryIdempotencyStore();

  const cartService = new CartService({
    cartRepository,
    catalogInventory,
    pricingEngine,
    eventBus,
    idempotencyStore,
  });

  const handler = createHttpHandler({
    cartService,
    catalogInventory,
    eventBus,
  });

  const server = createServer(handler);

  const purgeIntervalMs = config.purgeIntervalMs ?? 5 * 60 * 1000;
  const purgeTimer = setInterval(() => {
    void cartRepository.purgeExpired().catch((err) => {
      console.error('[PurgeWorker Error]', err);
    });
  }, purgeIntervalMs);
  purgeTimer.unref();

  return {
    server,
    cartService,
    catalogInventory,
    pricingEngine,
    eventBus,
    l1Cache,
    sqliteRepo,
    cartRepository,
    async close(): Promise<void> {
      clearInterval(purgeTimer);
      await new Promise<void>((resolve, reject) => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close((err) => (err ? reject(err) : resolve()));
      });
      sqliteRepo.close();
    },
  };
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  const app = createShoppingCartApp();

  app.server.listen(port, host, () => {
    console.log(
      `[ShoppingCart] Servidor activo en http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`,
    );
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[ShoppingCart] Señal ${signal} recibida. Cerrando conexiones de forma limpia...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
