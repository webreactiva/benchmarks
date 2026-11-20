import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import type { ProductRepository } from '../ports/repositories.js';
import type { CartService } from '../services/cart-service.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { cartRoutes, type CartRoutesDeps } from './routes/cart-routes.js';
import { productRoutes } from './routes/product-routes.js';

export interface AppDeps extends CartRoutesDeps {
  products: ProductRepository;
}

// src/http/app.ts → ../../public (funciona igual compilado en dist/http/).
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

/**
 * Fábrica de la aplicación Express. Recibe las dependencias ya construidas
 * (inyección), lo que permite montarla en tests o detrás de un proxy sin
 * tocar el resto del código.
 */
export function createApp(deps: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // UI de demostración (archivos estáticos, sin build de frontend).
  app.use(express.static(publicDir));

  app.use('/api/products', productRoutes({ products: deps.products }));
  app.use('/api/carts', cartRoutes({ cartService: deps.cartService }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
