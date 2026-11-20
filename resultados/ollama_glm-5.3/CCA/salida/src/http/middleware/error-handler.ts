import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { DomainError } from '../../domain/errors.js';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Envuelve handlers async para que sus errores lleguen al errorHandler.
 * (Express 5 ya lo hace solo, pero así funciona igual con cualquier versión.)
 */
export const asyncHandler =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/** 404 para rutas no mapeadas. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'ROUTE_NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.path}` },
  });
};

/**
 * ÚNICO punto de traducción error → respuesta HTTP.
 * - Errores de dominio: conservan su código y su estado.
 * - Errores de la propia pila HTTP (p. ej. JSON malformado): usan su `status`.
 * - Cualquier otro error: 500, registrado en el servidor y sin filtrar detalles
 *   de la implementación al cliente.
 */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof DomainError) {
    res.status(err.httpStatus).json({
      error: { code: err.code, message: err.message, details: err.details ?? null },
    });
    return;
  }

  // Errores de middleware de Express/body-parser: traen su propio status (400…).
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const message = err instanceof Error ? err.message : 'Petición inválida';
    res.status(status).json({ error: { code: 'INVALID_REQUEST', message } });
    return;
  }

  console.error('[http] error no controlado:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
};
