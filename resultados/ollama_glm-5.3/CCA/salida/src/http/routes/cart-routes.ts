import { Router } from 'express';
import { RequestValidationError } from '../../domain/errors.js';
import { MAX_QTY_PER_ITEM } from '../../domain/cart.js';
import type { CartService } from '../../services/cart-service.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { routeParam } from '../params.js';

export interface CartRoutesDeps {
  cartService: CartService;
}

function requireProductId(body: unknown): string {
  const { productId } = (body ?? {}) as Record<string, unknown>;
  if (typeof productId !== 'string' || productId.trim() === '') {
    throw new RequestValidationError("Se requiere 'productId' (string no vacío)");
  }
  return productId.trim();
}

function parseQuantity(body: unknown, { required }: { required: boolean }): number {
  const { quantity } = (body ?? {}) as Record<string, unknown>;
  if (quantity === undefined && !required) return 1;
  if (
    typeof quantity !== 'number' ||
    !Number.isSafeInteger(quantity) ||
    quantity < 0 ||
    quantity > MAX_QTY_PER_ITEM
  ) {
    throw new RequestValidationError(
      `'quantity' debe ser un entero entre 0 y ${MAX_QTY_PER_ITEM}`,
    );
  }
  return quantity;
}

/**
 * Endpoints del carrito. Validan la FORMA de la petición (transporte) y
 * delegan las reglas de negocio al servicio: nunca razonan sobre precios.
 */
export function cartRoutes(deps: CartRoutesDeps): Router {
  const { cartService } = deps;
  const router = Router();

  router.post(
    '/',
    asyncHandler(async (_req, res) => {
      const cart = await cartService.createCart();
      res.status(201).set('Location', `/api/carts/${cart.id}`).json(cart);
    }),
  );

  router.get(
    '/:cartId',
    asyncHandler(async (req, res) => {
      res.json(await cartService.getCart(routeParam(req, 'cartId')));
    }),
  );

  router.post(
    '/:cartId/items',
    asyncHandler(async (req, res) => {
      const productId = requireProductId(req.body);
      const quantity = parseQuantity(req.body, { required: false });
      const cartId = routeParam(req, 'cartId');
      res.status(201).json(await cartService.addItem(cartId, productId, quantity));
    }),
  );

  router.patch(
    '/:cartId/items/:productId',
    asyncHandler(async (req, res) => {
      const quantity = parseQuantity(req.body, { required: true });
      const cartId = routeParam(req, 'cartId');
      const productId = routeParam(req, 'productId');
      res.json(await cartService.setQuantity(cartId, productId, quantity));
    }),
  );

  router.delete(
    '/:cartId/items/:productId',
    asyncHandler(async (req, res) => {
      const cartId = routeParam(req, 'cartId');
      const productId = routeParam(req, 'productId');
      res.json(await cartService.removeItem(cartId, productId));
    }),
  );

  /** Vacía el contenido del carrito manteniendo su identidad. */
  router.delete(
    '/:cartId',
    asyncHandler(async (req, res) => {
      res.json(await cartService.clearCart(routeParam(req, 'cartId')));
    }),
  );

  router.post(
    '/:cartId/discount',
    asyncHandler(async (req, res) => {
      const { code } = (req.body ?? {}) as Record<string, unknown>;
      if (typeof code !== 'string' || code.trim() === '') {
        throw new RequestValidationError("Se requiere 'code' (string no vacío)");
      }
      res.json(await cartService.applyDiscount(routeParam(req, 'cartId'), code.trim()));
    }),
  );

  router.delete(
    '/:cartId/discount',
    asyncHandler(async (req, res) => {
      res.json(await cartService.removeDiscount(routeParam(req, 'cartId')));
    }),
  );

  router.post(
    '/:cartId/checkout',
    asyncHandler(async (req, res) => {
      res.status(201).json(await cartService.checkout(routeParam(req, 'cartId')));
    }),
  );

  return router;
}
