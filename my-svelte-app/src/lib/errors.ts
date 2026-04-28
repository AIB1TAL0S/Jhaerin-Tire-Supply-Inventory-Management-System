export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DuplicateProductError extends Error {
  constructor(brand: string, size: string, pattern: string) {
    super(`Product already exists: ${brand} ${size} ${pattern}`);
    this.name = 'DuplicateProductError';
  }
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class InsufficientStockError extends Error {
  constructor(available: number, requested: number) {
    super(`Insufficient stock: requested ${requested}, available ${available}`);
    this.name = 'InsufficientStockError';
  }
}
