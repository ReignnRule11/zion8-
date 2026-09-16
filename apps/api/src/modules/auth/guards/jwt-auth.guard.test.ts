import { describe, expect, it, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ErrorCode, Role, type AccessTokenClaims } from '@zion8/contracts';
import { DomainError, isDomainError } from '../../../common/errors/domain-error';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from '../../../common/security/decorators';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { SessionService } from '../session.service';
import type { TokenService } from '../token.service';

const claims: AccessTokenClaims = {
  sub: '11111111-1111-4111-8111-111111111111',
  email: 'pastor@grace.example',
  phone: null,
  isPlatformAdmin: false,
  tenantId: '22222222-2222-4222-8222-222222222222',
  role: Role.SENIOR_PASTOR,
  sessionId: '33333333-3333-4333-8333-333333333333',
  aal: 'AAL2',
  amr: ['PASSWORD', 'TOTP'],
  iat: 1,
  exp: 2,
};

function buildContext(request: Partial<Request>): ExecutionContext {
  if (typeof request.header !== 'function') {
    (request as { header: () => undefined }).header = () => undefined;
  }
  return {
    getType: () => 'http',
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildReflector(metadata: { public?: boolean; optional?: boolean }): Reflector {
  return {
    getAllAndOverride: vi.fn((key: string) => {
      if (key === IS_PUBLIC_KEY) return metadata.public ?? false;
      if (key === OPTIONAL_AUTH_KEY) return metadata.optional ?? false;
      return undefined;
    }),
  } as unknown as Reflector;
}

function buildGuard(options: {
  metadata?: { public?: boolean; optional?: boolean };
  token?: string | null;
  assertSessionActive?: () => Promise<void>;
}): { guard: JwtAuthGuard; assertSessionActive: ReturnType<typeof vi.fn> } {
  const assertSessionActive = vi.fn(options.assertSessionActive ?? (async () => undefined));
  const tokens = {
    extractBearerToken: () => options.token ?? null,
    verifyAccessToken: () => claims,
  } as unknown as TokenService;
  const sessions = { assertSessionActive } as unknown as SessionService;
  return {
    guard: new JwtAuthGuard(buildReflector(options.metadata ?? {}), tokens, sessions),
    assertSessionActive,
  };
}

async function expectDomainError(promise: Promise<unknown>, code: ErrorCode): Promise<void> {
  try {
    await promise;
    throw new Error('expected the guard to reject');
  } catch (error) {
    expect(isDomainError(error)).toBe(true);
    if (isDomainError(error)) expect(error.code).toBe(code);
  }
}

describe('JwtAuthGuard', () => {
  it('lets public routes through without a session check', async () => {
    const { guard, assertSessionActive } = buildGuard({ metadata: { public: true } });
    await expect(guard.canActivate(buildContext({}))).resolves.toBe(true);
    expect(assertSessionActive).not.toHaveBeenCalled();
  });

  it('rejects requests without a bearer token', async () => {
    const { guard } = buildGuard({});
    await expectDomainError(
      guard.canActivate(buildContext({})),
      ErrorCode.UNAUTHENTICATED,
    );
  });

  it('allows optional-auth routes without a token', async () => {
    const { guard } = buildGuard({ metadata: { optional: true } });
    await expect(guard.canActivate(buildContext({}))).resolves.toBe(true);
  });

  it('verifies the session behind a valid token and binds the principal', async () => {
    const request: Partial<Request> = {};
    const { guard, assertSessionActive } = buildGuard({ token: 'signed.jwt.token' });
    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);

    expect(assertSessionActive).toHaveBeenCalledWith(claims.sessionId, claims.sub);
    expect(request.principal?.userId).toBe(claims.sub);
    expect(request.principal?.assuranceLevel).toBe('AAL2');
  });

  it('rejects a revoked session even when the token signature is valid', async () => {
    const { guard } = buildGuard({
      token: 'signed.jwt.token',
      assertSessionActive: async () => {
        throw DomainError.tokenRevoked();
      },
    });

    await expectDomainError(
      guard.canActivate(buildContext({})),
      ErrorCode.TOKEN_REVOKED,
    );
  });
});
