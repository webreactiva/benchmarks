import { MemoryCartRepository } from './adapters/memory/memory-cart-repository.js';
import { MemoryProductRepository } from './adapters/memory/memory-product-repository.js';
import { SqliteCartRepository } from './adapters/sqlite/sqlite-cart-repository.js';
import { SqliteProductRepository } from './adapters/sqlite/sqlite-product-repository.js';
import { openDatabase } from './adapters/sqlite/db.js';
import { CATALOG } from './catalog.js';
import { loadConfig } from './config.js';
import { createApp } from './http/app.js';
import type { CartRepository, ProductRepository } from './ports/repositories.js';
import { CartService } from './services/cart-service.js';
import { PricingService } from './services/pricing-service.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const pricing = new PricingService(config.pricing);

  // La elección del adaptador de persistencia vive en UN único sitio.
  let cartRepository: CartRepository;
  let productRepository: ProductRepository;
  let closeDatabase: (() => void) | undefined;

  if (config.storage === 'sqlite') {
    const db = openDatabase(config.dbFile);
    cartRepository = new SqliteCartRepository(db);
    productRepository = new SqliteProductRepository(db, CATALOG);
    closeDatabase = () => db.close();
  } else {
    cartRepository = new MemoryCartRepository();
    productRepository = new MemoryProductRepository(CATALOG);
    console.warn('[bootstrap] STORAGE=memory: los datos se pierden al reiniciar');
  }

  const cartService = new CartService(cartRepository, productRepository, pricing);
  const app = createApp({ cartService, products: productRepository });

  const server = app.listen(config.port, () => {
    console.log(
      `🛒 Carrito escuchando en http://localhost:${config.port} (storage: ${config.storage})`,
    );
  });

  const shutdown = (signal: string) => {
    console.log(`\n[shutdown] ${signal} recibido, cerrando…`);
    server.close(() => {
      closeDatabase?.();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('Error arrancando el servidor:', error);
  process.exit(1);
});
