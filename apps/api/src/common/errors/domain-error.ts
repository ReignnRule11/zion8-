import { ErrorCode, type FieldIssue } from '@zion8/contracts';

const DEFAULT_STATUS: Partial<Record<ErrorCode, number>> = {
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.UNAUTHENTICATED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.TOKEN_REVOKED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.TENANT_REQUIRED]: 400,
  [ErrorCode.TENANT_NOT_FOUND]: 404,
  [ErrorCode.TENANT_SUSPENDED]: 403,
  [ErrorCode.TENANT_SLUG_TAKEN]: 409,
  [ErrorCode.TENANT_MEMBERSHIP_REQUIRED]: 403,
  [ErrorCode.EMAIL_ALREADY_REGISTERED]: 409,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: FieldIssue[];

  constructor(code: ErrorCode, message: string, details?: FieldIssue[], httpStatus?: number) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus ?? DEFAULT_STATUS[code] ?? 500;
  }

  static validation(details: FieldIssue[], message = 'Request validation failed'): DomainError {
    return new DomainError(ErrorCode.VALIDATION_FAILED, message, details);
  }

  static unauthenticated(message = 'Authentication is required'): DomainError {
    return new DomainError(ErrorCode.UNAUTHENTICATED, message);
  }

  static invalidCredentials(message = 'Invalid email or password'): DomainError {
    return new DomainError(ErrorCode.INVALID_CREDENTIALS, message);
  }

  static tokenExpired(message = 'Session has expired'): DomainError {
    return new DomainError(ErrorCode.TOKEN_EXPIRED, message);
  }

  static tokenRevoked(message = 'Session has been revoked'): DomainError {
    return new DomainError(ErrorCode.TOKEN_REVOKED, message);
  }

  static forbidden(message = 'You do not have permission to perform this action'): DomainError {
    return new DomainError(ErrorCode.FORBIDDEN, message);
  }

  static tenantRequired(message = 'A tenant context is required'): DomainError {
    return new DomainError(ErrorCode.TENANT_REQUIRED, message);
  }

  static tenantNotFound(message = 'Church workspace not found'): DomainError {
    return new DomainError(ErrorCode.TENANT_NOT_FOUND, message);
  }

  static tenantSuspended(message = 'Church workspace is suspended'): DomainError {
    return new DomainError(ErrorCode.TENANT_SUSPENDED, message);
  }

  static tenantSlugTaken(message = 'That workspace address is already in use'): DomainError {
    return new DomainError(ErrorCode.TENANT_SLUG_TAKEN, message);
  }

  static membershipRequired(
    message = 'You are not a member of this church workspace',
  ): DomainError {
    return new DomainError(ErrorCode.TENANT_MEMBERSHIP_REQUIRED, message);
  }

  static emailRegistered(message = 'An account with this email already exists'): DomainError {
    return new DomainError(ErrorCode.EMAIL_ALREADY_REGISTERED, message);
  }

  static notFound(message = 'Resource not found'): DomainError {
    return new DomainError(ErrorCode.RESOURCE_NOT_FOUND, message);
  }

  static conflict(message = 'Resource conflict'): DomainError {
    return new DomainError(ErrorCode.RESOURCE_CONFLICT, message);
  }

  static rateLimited(message = 'Too many requests'): DomainError {
    return new DomainError(ErrorCode.RATE_LIMITED, message);
  }

  static internal(message = 'An unexpected error occurred'): DomainError {
    return new DomainError(ErrorCode.INTERNAL_ERROR, message);
  }

  static unavailable(message = 'Service temporarily unavailable'): DomainError {
    return new DomainError(ErrorCode.SERVICE_UNAVAILABLE, message);
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
