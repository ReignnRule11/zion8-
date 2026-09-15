import { Injectable } from '@nestjs/common';
import type { Env } from './env';
import { loadEnv } from './env';

@Injectable()
export class AppConfigService {
  private readonly env: Env;

  constructor(source?: NodeJS.ProcessEnv) {
    this.env = loadEnv(source);
  }

  get value(): Env {
    return this.env;
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.env.NODE_ENV;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get port(): number {
    return this.env.PORT;
  }

  get globalPrefix(): string {
    return this.env.API_GLOBAL_PREFIX;
  }

  get apiVersion(): string {
    return this.env.API_VERSION;
  }

  get appBaseUrl(): string {
    return this.env.APP_BASE_URL;
  }

  get corsOrigins(): string[] {
    return this.env.CORS_ORIGINS;
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get redisUrl(): string {
    return this.env.REDIS_URL;
  }

  get jwtAccessSecret(): string {
    return this.env.JWT_ACCESS_SECRET;
  }

  get jwtAccessTtlSeconds(): number {
    return this.env.JWT_ACCESS_TTL_SECONDS;
  }

  get refreshTtlSeconds(): number {
    return this.env.REFRESH_TTL_SECONDS;
  }

  get argon2Options(): { memoryCost: number; timeCost: number; parallelism: number } {
    return {
      memoryCost: this.env.ARGON2_MEMORY_COST,
      timeCost: this.env.ARGON2_TIME_COST,
      parallelism: this.env.ARGON2_PARALLELISM,
    };
  }

  get logLevel(): Env['LOG_LEVEL'] {
    return this.env.LOG_LEVEL;
  }
}
