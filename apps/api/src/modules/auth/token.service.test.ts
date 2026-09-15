import { afterEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@zion8/contracts';
import { AppConfigService } from '../../common/config/app-config.service';
import { isDomainError } from '../../common/errors/domain-error';
import { testEnv, testEnvWith } from '../../testing/test-env';
import { TokenService } from './token.service';

function buildService(overrides: Record<string, string> = {}): TokenService {
  return new TokenService(new AppConfigService(testEnvWith(overrides)));
}

const accessInput = {
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'pastor@grace.example',
  isPlatformAdmin: false,
  tenantId: '22222222-2222-4222-8222-222222222222',
  role: Role.SENIOR_PASTOR,
  sessionId: '33333333-3333-4333-8333-333333333333',
};

describe('TokenService access tokens', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('round-trips the signed claims', () => {
    const service = buildService();
    const { token, expiresIn } = service.signAccessToken(accessInput);
    expect(expiresIn).toBe(900);

    const claims = service.verifyAccessToken(token);
    expect(claims.sub).toBe(accessInput.userId);
    expect(claims.email).toBe(accessInput.email);
    expect(claims.tenantId).toBe(accessInput.tenantId);
    expect(claims.role).toBe(Role.SENIOR_PASTOR);
    expect(claims.sessionId).toBe(accessInput.sessionId);
  });

  it('rejects a tampered token as unauthenticated', () => {
    const service = buildService();
    const { token } = service.signAccessToken(accessInput);
    const tampered = `${token.slice(0, -2)}xy`;

    try {
      service.verifyAccessToken(tampered);
      throw new Error('expected verification to fail');
    } catch (error) {
      expect(isDomainError(error)).toBe(true);
      if (isDomainError(error)) expect(error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('reports an expired token distinctly', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const service = buildService({ JWT_ACCESS_TTL_SECONDS: '1' });
    const { token } = service.signAccessToken(accessInput);

    vi.setSystemTime(new Date('2026-01-01T00:00:05.000Z'));
    try {
      service.verifyAccessToken(token);
      throw new Error('expected verification to fail');
    } catch (error) {
      expect(isDomainError(error)).toBe(true);
      if (isDomainError(error)) expect(error.code).toBe('TOKEN_EXPIRED');
    }
  });

  it('rejects tokens signed with a different secret', () => {
    const issuer = buildService({ JWT_ACCESS_SECRET: 'secret-one-with-at-least-32-characters' });
    const verifier = buildService({
      JWT_ACCESS_SECRET: 'secret-two-with-at-least-32-characters',
    });
    const { token } = issuer.signAccessToken(accessInput);
    expect(() => verifier.verifyAccessToken(token)).toThrow();
  });
});

describe('TokenService refresh token helpers', () => {
  it('produces opaque, unique refresh tokens', () => {
    const service = buildService();
    const first = service.issueRefreshToken();
    const second = service.issueRefreshToken();
    expect(first.token).not.toBe(second.token);
    expect(first.sessionId).not.toBe(second.sessionId);
    expect(first.token.length).toBeGreaterThanOrEqual(64);
    expect(first.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('keeps rotation inside the same session when a session id is supplied', () => {
    const service = buildService();
    const sessionId = service.newSessionId();
    const rotated = service.issueRefreshToken(sessionId);
    expect(rotated.sessionId).toBe(sessionId);
  });

  it('hashes refresh tokens deterministically without storing the secret', () => {
    const service = buildService();
    const { token, tokenHash } = service.issueRefreshToken();
    expect(service.hashRefreshToken(token)).toBe(tokenHash);
    expect(tokenHash).not.toContain(token);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('compares hashes in constant time and rejects mismatches', () => {
    const service = buildService();
    const first = service.hashRefreshToken('token-a');
    expect(service.safeEqualHex(first, first)).toBe(true);
    expect(service.safeEqualHex(first, service.hashRefreshToken('token-b'))).toBe(false);
    expect(service.safeEqualHex(first, 'ff')).toBe(false);
  });

  it('extracts only well-formed bearer tokens', () => {
    const service = buildService();
    expect(service.extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(service.extractBearerToken('bearer abc')).toBe('abc');
    expect(service.extractBearerToken(undefined)).toBeNull();
    expect(service.extractBearerToken('Basic abc')).toBeNull();
    expect(service.extractBearerToken('Bearer ')).toBeNull();
  });
});

describe('TokenService configuration usage', () => {
  it('reads the refresh ttl from configuration', () => {
    const service = buildService({ REFRESH_TTL_SECONDS: '3600' });
    expect(service.ttlSeconds()).toBe(3600);
    const before = Date.now();
    const expiresAt = service.refreshExpiry().getTime();
    expect(expiresAt - before).toBeGreaterThan(3_590_000);
    expect(expiresAt - before).toBeLessThanOrEqual(3_601_000);
  });

  it('uses the shared default ttl from the test environment', () => {
    expect(testEnv.REFRESH_TTL_SECONDS).toBe('2592000');
  });
});
