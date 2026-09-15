import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/common/config/app-config.service';

interface Session {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

const runId = Date.now().toString(36);
const slug = `e2e-chapel-${runId}`;
const email = `owner-${runId}@grace.example`;
const password = 'faithful8church';

let app: INestApplication;

function api(): request.Test {
  return request(app.getHttpServer());
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  const config = app.get(AppConfigService);
  app.setGlobalPrefix(config.globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: config.apiVersion });
  await app.init();
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
