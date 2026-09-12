export type ErrorDetail = {
  field?: string;
  message: string;
  code?: string;
};

/**
 * Base class for every error intentionally thrown by the application.
 * Anything that is not an AppError is treated as an unexpected failure
 * by the global error handler and is never leaked to the client.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ErrorDetail[];
  public readonly isOperational = true;

  constructor(message: string, statusCode = 400, code = 'APP_ERROR', details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Requisicao invalida.', details?: ErrorDetail[]) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados invalidos.', details?: ErrorDetail[]) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Credenciais invalidas ou ausentes.') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado para este recurso.') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso') {
    super(`${resource} nao encontrado.`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Registro ja existente.', details?: ErrorDetail[]) {
    super(message, 409, 'CONFLICT', details);
  }
}

/** Violation of a domain rule (e.g. reserva sobreposta, unidade ocupada). */
export class BusinessRuleError extends AppError {
  constructor(message: string, details?: ErrorDetail[]) {
    super(message, 409, 'BUSINESS_RULE_VIOLATION', details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Muitas requisicoes. Tente novamente em instantes.') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Erro interno do servidor.') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}
