import { describe, expect, it, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { Permission, Role, ErrorCode } from '@zion8/contracts';
import type { Request } from 'express';
import { isDomainError } from '../../../common/errors/domain-error';
import {
  IS_PUBLIC_KEY,
  OPTIONAL_AUTH_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
} from '../../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../../common/security/principal';
import { AuthorizationGuard } from './authorization.guard';
import type { ExecutionContext } from '@nestjs/common';

interface Metadata {
  public?: boolean;
  optional?: boolean;
  permissions?: Permission[];
  roles?: Role[];
}

function buildContext(request: Partial<Request>): ExecutionContext {
  return {
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildReflector(metadata: Metadata): Reflector {
  return {
    getAllAndOverride: vi.fn((key: string) => {
      switch (key) {
        case IS_PUBLIC_KEY:
          return metadata.public ?? false;
        case OPTIONAL_AUTH_KEY:
          return metadata.optional ?? false;
        case PERMISSIONS_KEY:
          return metadata.permissions;
        case ROLES_KEY:
          return metadata.roles;
        default:
          return undefined;
      }
    }),
  } as unknown as Reflector;
}

function principal(overrides: Partial<AuthenticatedPrincipal> = {}): AuthenticatedPrincipal {
  return {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'admin@grace.example',
    isPlatformAdmin: false,
    tenantId: '22222222-2222-4222-8222-222222222222',
    role: Role.ADMINISTRATOR,
    sessionId: '33333333-3333-4333-8333-333333333333',
    ...overrides,
  };
}

function run(metadata: Metadata, request: Partial<Request>): boolean {
  const guard = new AuthorizationGuard(buildReflector(metadata));
  return guard.canActivate(buildContext(request));
}

describe('AuthorizationGuard', () => {
  it('allows public routes without a principal', () => {
    expect(run({ public: true, permissions: [Permission.MEMBER_CREATE] }, {})).toBe(true);
  });

  it('allows routes without declared requirements', () => {
    expect(run({}, {})).toBe(true);
  });

  it('requires authentication when permissions are declared', () => {
    try {
      run({ permissions: [Permission.MEMBER_READ] }, {});
      throw new Error('expected failure');
    } catch (error) {
      expect(isDomainError(error)).toBe(true);
      if (isDomainError(error)) expect(error.code).toBe(ErrorCode.UNAUTHENTICATED);
    }
  });

  it('allows optional-auth routes with no principal', () => {
    expect(run({ optional: true, permissions: [Permission.MEMBER_READ] }, {})).toBe(true);
  });

  it('grants access when the role holds the permission', () => {
    expect(run({ permissions: [Permission.MEMBER_CREATE] }, { principal: principal() })).toBe(true);
  });

  it('denies access when the role lacks the permission', () => {
    const request = { principal: principal({ role: Role.VOLUNTEER }) };
    try {
      run({ permissions: [Permission.MEMBER_ARCHIVE] }, request);
      throw new Error('expected failure');
    } catch (error) {
      expect(isDomainError(error)).toBe(true);
      if (isDomainError(error)) expect(error.code).toBe(ErrorCode.FORBIDDEN);
    }
  });

  it('denies when the principal has no active role', () => {
    const request = { principal: principal({ role: null, tenantId: null }) };
    try {
      run({ permissions: [Permission.MEMBER_READ] }, request);
      throw new Error('expected failure');
    } catch (error) {
      expect(isDomainError(error)).toBe(true);
      if (isDomainError(error)) expect(error.code).toBe(ErrorCode.FORBIDDEN);
    }
  });

  it('requires a tenant context for role-scoped endpoints', () => {
    const request = { principal: principal({ tenantId: null }) };
    try {
      run({ permissions: [Permission.MEMBER_READ] }, request);
      throw new Error('expected failure');
    } catch (error) {
      expect(isDomainError(error)).toBe(true);
      if (isDomainError(error)) expect(error.code).toBe(ErrorCode.TENANT_REQUIRED);
    }
  });

  it('lets platform administrators bypass role checks', () => {
    const request = {
      principal: principal({ isPlatformAdmin: true, role: null, tenantId: null }),
    };
    expect(run({ permissions: [Permission.TENANT_DELETE] }, request)).toBe(true);
  });

  it('enforces explicit role allowlists', () => {
    const allowed = { principal: principal({ role: Role.SENIOR_PASTOR }) };
    expect(run({ roles: [Role.SENIOR_PASTOR, Role.CHURCH_OWNER] }, allowed)).toBe(true);

    const denied = { principal: principal({ role: Role.VOLUNTEER }) };
    try {
      run({ roles: [Role.SENIOR_PASTOR] }, denied);
      throw new Error('expected failure');
    } catch (error) {
      expect(isDomainError(error)).toBe(true);
      if (isDomainError(error)) expect(error.code).toBe(ErrorCode.FORBIDDEN);
    }
  });
});
