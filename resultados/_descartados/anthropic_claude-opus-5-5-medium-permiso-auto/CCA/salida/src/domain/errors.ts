/**
 * Errores de dominio. Cada error lleva un código estable (para clientes)
 * y el código HTTP con el que la capa web debe traducirlo.
 */
export class DomainError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: string, message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 422, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, 404, details);
  }
}

/** Conflicto de negocio (sin stock, carrito cerrado, precios cambiados...). */
export class BusinessConflictError extends DomainError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, 409, details);
  }
}

/** Otro proceso modificó el carrito entre la lectura y la escritura. Reintentable. */
export class ConcurrencyError extends DomainError {
  constructor(cartId: string) {
    super('CONCURRENT_MODIFICATION', `El carrito ${cartId} fue modificado concurrentemente`, 409, { cartId });
  }
}

/** El cliente envió If-Match con una versión que ya no es la actual. */
export class PreconditionFailedError extends DomainError {
  constructor(expected: number, actual: number) {
    super('VERSION_MISMATCH', 'La versión del carrito no coincide', 412, { expected, actual });
  }
}
