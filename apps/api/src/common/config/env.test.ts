import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';
import { testEnv } from '../../testing/test-env';

describe('environment configuration', () => {
  it('parses a complete configuration', () => {
    const env = loadEnv(testEnv);
    expect(env.PORT).toBe(4000);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
  });

  it('splits and trims the CORS origin list', () => {
    const env = loadEnv({
      ...testEnv,
      CORS_ORIGINS: 'https://a.example , https://b.example,,',
    });
    expect(env.CORS_ORIGINS).toEqual(['https://a.example', 'https://b.example']);
  });

  it('applies documented defaults for optional values', () => {
    const minimal = { ...testEnv };
    delete minimal.PORT;
    delete minimal.LOG_LEVEL;
    delete minimal.API_GLOBAL_PREFIX;
    const env = loadEnv(minimal);
    expect(env.PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.API_GLOBAL_PREFIX).toBe('api');
  });

  it('rejects a short JWT secret', () => {
    expect(() => loadEnv({ ...testEnv, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('rejects an invalid application base url', () => {
    expect(() => loadEnv({ ...testEnv, APP_BASE_URL: 'not-a-url' })).toThrow(/APP_BASE_URL/);
  });

  it('rejects a missing database url', () => {
    const broken = { ...testEnv };
    delete broken.DATABASE_URL;
    expect(() => loadEnv(broken)).toThrow(/DATABASE_URL/);
  });
});
