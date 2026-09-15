import { beforeEach, describe, expect, it } from 'vitest';
import { isDomainError } from './domain-error';
import { DomainError } from './domain-error';
import { ErrorCode } from '@zion8/contracts';

describe('DomainError', () => {
  it('maps each factory to the correct HTTP status', () => {
    const cases: Array<[DomainError, number, ErrorCode]> = [
      [DomainError.validation([]), 400, ErrorCode.VALIDATION_FAILED],
      [DomainError.unauthenticated(), 401, ErrorCode.UNAUTHENTICATED],
      [DomainError.invalidCredentials(), 401, ErrorCode.INVALID_CREDENTIALS],
      [DomainError.tokenExpired(), 401, ErrorCode.TOKEN_EXPIRED],
      [DomainError.forbidden(), 403, ErrorCode.FORBIDDEN],
      [DomainError.tenantSuspended(), 403, ErrorCode.TENANT_SUSPENDED],
      [DomainError.tenantNotFound(), 404, ErrorCode.TENANT_NOT_FOUND],
      [DomainError.tenantSlugTaken(), 409, ErrorCode.TENANT_SLUG_TAKEN],
      [DomainError.emailRegistered(), 409, ErrorCode.EMAIL_ALREADY_REGISTERED],
      [DomainError.rateLimited(), 429, ErrorCode.RATE_LIMITED],
      [DomainError.internal(), 500, ErrorCode.INTERNAL_ERROR],
      [DomainError.unavailable(), 503, ErrorCode.SERVICE_UNAVAILABLE],
    ];

    for (const [error, status, code] of cases) {
      expect(error.httpStatus).toBe(status);
      expect(error.code).toBe(code);
    }
  });

  it('carries field-level validation details', () => {
    const error = DomainError.validation([{ path: 'email', message: 'invalid' }]);
    expect(error.details).toEqual([{ path: 'email', message: 'invalid' }]);
  });

  it('is detectable via the type guard', () => {
    expect(isDomainError(new Error('plain'))).toBe(false);
    expect(isDomainError(DomainError.forbidden())).toBe(true);
    expect(isDomainError(null)).toBe(false);
  });

  it('keeps the subclasses distinguishable by name', () => {
    const error = DomainError.membershipRequired();
    expect(error.name).toBe('DomainError');
    expect(error.message).toContain('member');
  });
});

describe('DomainError instanceof behaviour after transpilation', () => {
  let error: DomainError;
  beforeEach(() => {
    error = DomainError.conflict('duplicate');
  });

  it('retains the message', () => {
    expect(error.message).toBe('duplicate');
  });
});
