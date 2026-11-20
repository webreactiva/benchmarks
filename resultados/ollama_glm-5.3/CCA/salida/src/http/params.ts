import type { Request } from 'express';

/**
 * Lee un parámetro de ruta. En Express 5 el tipo de `req.params` permite
 * arrays (por los comodines de path-to-regexp); en estas rutas los nombres
 * simples siempre son strings.
 */
export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? '') : value;
}
