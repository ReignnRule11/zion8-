import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/common/config/app-config.service';
import { totpCode } from '../src/common/crypto/totp';
import { LoggingNotificationService } from '../src/modules/notifications/logging-notification.adapter';

interface Session {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn: number;
  sessionId: string;
  assuranceLevel: string;
  mfaSatisfied: boolean;
}

interface MfaRequired {
  mfaRequired: true;
  mfaToken: string;
  factors: Array<{ id: string; type: string; name: string }>;
}

const runId = Date.now().toString(36);
const slug = `e2e-chapel-${runId}`;
const email = `owner-${runId}@grace.example`;
const password = 'faithful8church';

const flowSlug = `e2e-flows-${runId}`;
const flowEmail = `flows-${runId}@grace.example`;

let app: INestApplication;
let notifications: LoggingNotificationService;

function api(): request.Test {
  return request(app.getHttpServer());
}

function tokenFromEmail(body: string): string {
  const match = /token=([^\s&]+)/u.exec(body);
  if (!match?.[1]) throw new Error(`No token found in notification body: ${body}`);
  return decodeURIComponent(match[1]);
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  const config = app.get(AppConfigService);
  app.setGlobalPrefix(config.globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: config.apiVersion });
  await app.init();
  notifications = app.get(LoggingNotificationService);
});

afterAll(async () => {
  await app?.close();
});

describe('auth lifecycle (real Postgres + Redis)', () => {
  let session: Session;

  it('reports liveness', async () => {
    const response = await api().get('/api/v1/health/live').expect(200);
    expect(response.body.status).toBe('ok');
  });

  it('reports readiness with both dependencies up', async () => {
    const response = await api().get('/api/v1/health/ready').expect(200);
    expect(response.body.status).toBe('ok');
    const names = response.body.dependencies.map((dependency: { name: string }) => dependency.name);
    expect(names).toContain('postgres');
    expect(names).toContain('redis');
  });

  it('registers a church workspace and returns a session', async () => {
    const response = await api()
      .post('/api/v1/auth/register-church')
      .send({
        church: { name: 'E2E Chapel', slug, timezone: 'Africa/Lagos', locale: 'en' },
        owner: { firstName: 'Grace', lastName: 'Owner', email, password },
      })
      .expect(201);

    session = response.body as Session;
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
    expect(session.tokenType).toBe('Bearer');
    expect(session.expiresIn).toBeGreaterThan(0);
  });

  it('rejects a duplicate workspace slug', async () => {
    const response = await api()
      .post('/api/v1/auth/register-church')
      .send({
        church: { name: 'Duplicate', slug, timezone: 'UTC', locale: 'en' },
        owner: {
          firstName: 'Dup',
          lastName: 'Owner',
          email: `dup-${runId}@grace.example`,
          password,
        },
      })
      .expect(409);
    expect(response.body.error.code).toBe('TENANT_SLUG_TAKEN');
  });

  it('rejects an invalid registration payload with field details', async () => {
    const response = await api()
      .post('/api/v1/auth/register-church')
      .send({
        church: { name: 'x', slug: 'INVALID_SLUG' },
        owner: { firstName: 'A', lastName: 'B', email: 'not-an-email', password: 'short' },
      })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(Array.isArray(response.body.error.details)).toBe(true);
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it('denies access to a protected route without a token', async () => {
    const response = await api().get('/api/v1/auth/me').expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns the authenticated principal and permissions', async () => {
    const response = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    expect(response.body.principal.email).toBe(email);
    expect(response.body.role).toBe('CHURCH_OWNER');
    expect(response.body.activeTenant.slug).toBe(slug);
    expect(response.body.permissions).toContain('member:create');
    expect(response.body.memberships).toHaveLength(1);
  });

  it('rejects an incorrect password', async () => {
    const response = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password-1' })
      .expect(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs in with valid credentials', async () => {
    const response = await api()
      .post('/api/v1/auth/login')
      .send({ email, password, tenantSlug: slug })
      .expect(200);
    session = response.body as Session;
    expect(session.accessToken).toBeTruthy();
  });

  it('rotates the refresh token and invalidates the previous one', async () => {
    const first = session.refreshToken;
    const rotated = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first })
      .expect(200);
    expect(rotated.body.refreshToken).not.toBe(first);

    const reuse = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first })
      .expect(401);
    expect(reuse.body.error.code).toBe('TOKEN_REVOKED');

    session = rotated.body as Session;
  });

  it('revokes the refresh family on logout', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email, password, tenantSlug: slug })
      .expect(200);
    const token = (login.body as Session).refreshToken;

    await api().post('/api/v1/auth/logout').send({ refreshToken: token }).expect(204);

    const reuse = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: token })
      .expect(401);
    expect(reuse.body.error.code).toBe('TOKEN_REVOKED');
  });
});

describe('enterprise authentication flows (real Postgres + Redis)', () => {
  let session: Session;
  let totpSecret: string;

  beforeAll(async () => {
    notifications.clear();
    const response = await api()
      .post('/api/v1/auth/register-church')
      .send({
        church: { name: 'E2E Flows', slug: flowSlug, timezone: 'UTC', locale: 'en' },
        owner: { firstName: 'Flow', lastName: 'Tester', email: flowEmail, password },
      })
      .expect(201);
    session = response.body as Session;
  });

  it('signs in with a single-use magic link', async () => {
    notifications.clear();
    await api()
      .post('/api/v1/auth/magic-link')
      .send({ email: flowEmail, tenantSlug: flowSlug })
      .expect(202);

    const captured = notifications.lastFor(flowEmail, 'email');
    expect(captured).not.toBeNull();
    const token = tokenFromEmail(captured!.body);

    const consumed = await api()
      .post('/api/v1/auth/magic-link/consume')
      .send({ token })
      .expect(200);
    const magicSession = consumed.body as Session;
    expect(magicSession.accessToken).toBeTruthy();
    expect(magicSession.sessionId).toBeTruthy();

    const replay = await api()
      .post('/api/v1/auth/magic-link/consume')
      .send({ token })
      .expect(400);
    expect(replay.body.error.code).toBe('CHALLENGE_CONSUMED');
  });

  it('signs in with an email one-time code', async () => {
    notifications.clear();
    await api().post('/api/v1/auth/otp').send({ email: flowEmail }).expect(202);

    const captured = notifications.lastFor(flowEmail, 'email');
    expect(captured).not.toBeNull();
    const code = /code is (\d{6})/u.exec(captured!.body)?.[1];
    expect(code).toBeTruthy();

    const verified = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ email: flowEmail, code })
      .expect(200);
    expect((verified.body as Session).accessToken).toBeTruthy();

    const replay = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ email: flowEmail, code })
      .expect(400);
    expect(replay.body.error.code).toBe('INVALID_CHALLENGE');
  });

  it('rejects an incorrect one-time code', async () => {
    notifications.clear();
    await api().post('/api/v1/auth/otp').send({ email: flowEmail }).expect(202);

    const wrong = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ email: flowEmail, code: '000000' })
      .expect(400);
    expect(wrong.body.error.code).toBe('INVALID_CHALLENGE');
  });

  it('enrolls TOTP, steps up on login, and returns recovery codes', async () => {
    const enrollment = await api()
      .post('/api/v1/auth/mfa/totp')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ name: 'E2E authenticator' })
      .expect(201);
    expect(enrollment.body.type).toBe('TOTP');
    expect(enrollment.body.secret).toBeTruthy();
    totpSecret = enrollment.body.secret as string;

    const confirm = await api()
      .post('/api/v1/auth/mfa/totp/confirm')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ factorId: enrollment.body.factorId, code: totpCode(totpSecret) })
      .expect(200);
    expect(confirm.body.factor.status).toBe('ACTIVE');
    expect(confirm.body.recoveryCodes.length).toBeGreaterThan(0);

    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: flowEmail, password, tenantSlug: flowSlug })
      .expect(200);
    const challenge = login.body as MfaRequired;
    expect(challenge.mfaRequired).toBe(true);
    expect(challenge.mfaToken).toBeTruthy();
    expect(challenge.factors).toHaveLength(1);

    await api()
      .post('/api/v1/auth/mfa/verify')
      .send({ mfaToken: challenge.mfaToken, code: '000000' })
      .expect(401);

    const verified = await api()
      .post('/api/v1/auth/mfa/verify')
      .send({ mfaToken: challenge.mfaToken, code: totpCode(totpSecret) })
      .expect(200);
    session = verified.body as Session;
    expect(session.mfaSatisfied).toBe(true);
    expect(session.assuranceLevel).toBe('AAL2');
  });

  it('lists sessions and marks the current one', async () => {
    const response = await api()
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    const current = response.body.sessions.find(
      (entry: { id: string }) => entry.id === session.sessionId,
    );
    expect(current).toBeTruthy();
    expect(current.current).toBe(true);
  });

  it('revokes a session and rejects its access token afterwards', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: flowEmail, password, tenantSlug: flowSlug })
      .expect(200);
    const challenge = login.body as MfaRequired;

    const steppedUp = await api()
      .post('/api/v1/auth/mfa/verify')
      .send({ mfaToken: challenge.mfaToken, code: totpCode(totpSecret) })
      .expect(200);
    const secondary = steppedUp.body as Session;
    expect(secondary.sessionId).not.toBe(session.sessionId);

    await api()
      .delete(`/api/v1/auth/sessions/${secondary.sessionId}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(204);

    const rejected = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${secondary.accessToken}`)
      .expect(401);
    expect(rejected.body.error.code).toBe('TOKEN_REVOKED');
  });

  it('resets the password with a single-use token', async () => {
    const newPassword = 'renewed9covenant';
    notifications.clear();

    await api().post('/api/v1/auth/password/reset').send({ email: flowEmail }).expect(202);
    const captured = notifications.lastFor(flowEmail, 'email');
    expect(captured).not.toBeNull();
    const token = tokenFromEmail(captured!.body);

    await api()
      .post('/api/v1/auth/password/reset/consume')
      .send({ token, newPassword })
      .expect(204);

    const replay = await api()
      .post('/api/v1/auth/password/reset/consume')
      .send({ token, newPassword })
      .expect(400);
    expect(replay.body.error.code).toBe('CHALLENGE_CONSUMED');

    await api()
      .post('/api/v1/auth/login')
      .send({ email: flowEmail, password, tenantSlug: flowSlug })
      .expect(401);

    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: flowEmail, password: newPassword, tenantSlug: flowSlug })
      .expect(200);
    expect((login.body as MfaRequired).mfaRequired).toBe(true);
  });
});

