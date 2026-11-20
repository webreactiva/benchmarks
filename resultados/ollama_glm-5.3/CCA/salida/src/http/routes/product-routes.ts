import { Router } from 'express';
import { ProductNotFoundError } from '../../domain/errors.js';
import type { ProductRepository } from '../../ports/repositories.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { routeParam } from '../params.js';

export interface ProductRoutesDeps {
  products: ProductRepository;
}

/** Endpoints de catálogo. Thin controllers: solo parsean y delegan. */
export function productRoutes(deps: ProductRoutesDeps): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ products: await deps.products.findAll() });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = routeParam(req, 'id');
      const product = await deps.products.findById(id);
      if (!product) throw new ProductNotFoundError(id);
      res.json({ product });
    }),
  );

  return router;
}
