// Errores de dominio. Cada uno lleva un `status` HTTP para que la capa web
// pueda traducirlos sin conocer la lógica de negocio.

export class DomainError extends Error {
  constructor(message, { code = 'DOMAIN_ERROR', status = 400, details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message, details) {
    super(message, { code: 'VALIDATION_ERROR', status: 400, details });
  }
}

export class NotFoundError extends DomainError {
  constructor(message) {
    super(message, { code: 'NOT_FOUND', status: 404 });
  }
}

/** Otro proceso modificó el carrito entre la lectura y la escritura. */
export class ConcurrencyError extends DomainError {
  constructor(cartId, expected, actual) {
    super(`Conflicto de versión en el carrito ${cartId}`, {
      code: 'VERSION_CONFLICT',
      status: 409,
      details: { expected, actual },
    });
  }
}

export class LimitExceededError extends DomainError {
  constructor(message, details) {
    super(message, { code: 'LIMIT_EXCEEDED', status: 422, details });
  }
}

export class OutOfStockError extends DomainError {
  constructor(sku, available) {
    super(`Stock insuficiente para ${sku}`, {
      code: 'OUT_OF_STOCK',
      status: 422,
      details: { sku, available },
    });
  }
}
