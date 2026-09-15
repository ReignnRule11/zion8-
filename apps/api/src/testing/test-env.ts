import type { Env } from '../common/config/env';

export const testEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '4000',
  API_GLOBAL_PREFIX: 'api',
  API_VERSION: 'v1',
  APP_BASE_URL: 'http://localhost:4000',
  WEB_BASE_URL: 'http://localhost:3000',
  CORS_ORIGINS: 'http://localhost:3000,http://localhost:3001',
  DATABASE_URL: 'postgresql://zion8_app:secret@localhost:5432/zion8?schema=public',
  MIGRATION_DATABASE_URL: 'postgresql://zion8:secret@localhost:5432/zion8?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-secret-value-with-at-least-32-chars',
  JWT_ACCESS_TTL_SECONDS: '900',
  REFRESH_TTL_SECONDS: '2592000',
  ENCRYPTION_KEY: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
  WEBAUTHN_ORIGINS: 'http://localhost:3000',
  ARGON2_MEMORY_COST: '8192',
  ARGON2_TIME_COST: '2',
  ARGON2_PARALLELISM: '1',
  LOG_LEVEL: 'silent',
};

export function testEnvWith(overrides: Partial<Env>): NodeJS.ProcessEnv {
  return { ...testEnv, ...overrides } as NodeJS.ProcessEnv;
}
