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

  get isTest(): boolean {
    return this.env.NODE_ENV === 'test';
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

  get encryptionKey(): Buffer {
    return Buffer.from(this.env.ENCRYPTION_KEY, 'base64');
  }

  get verificationTtlSeconds(): number {
    return this.env.VERIFICATION_TTL_SECONDS;
  }

  get magicLinkTtlSeconds(): number {
    return this.env.MAGIC_LINK_TTL_SECONDS;
  }

  get invitationTtlSeconds(): number {
    return this.env.INVITATION_TTL_SECONDS;
  }

  get mfaChallengeTtlSeconds(): number {
    return this.env.MFA_CHALLENGE_TTL_SECONDS;
  }

  get totpIssuer(): string {
    return this.env.TOTP_ISSUER;
  }

  get webBaseUrl(): string {
    return this.env.WEB_BASE_URL;
  }

  get webauthn(): { rpId: string; rpName: string; origins: string[] } {
    return {
      rpId: this.env.WEBAUTHN_RP_ID,
      rpName: this.env.WEBAUTHN_RP_NAME,
      origins: this.env.WEBAUTHN_ORIGINS.length > 0 ? this.env.WEBAUTHN_ORIGINS : this.env.CORS_ORIGINS,
    };
  }

  get oauth(): {
    google: { clientId: string; clientSecret: string };
    apple: { clientId: string; teamId: string; keyId: string; privateKey: string };
    microsoft: { clientId: string; clientSecret: string; tenantId: string };
  } {
    return {
      google: {
        clientId: this.env.GOOGLE_CLIENT_ID,
        clientSecret: this.env.GOOGLE_CLIENT_SECRET,
      },
      apple: {
        clientId: this.env.APPLE_CLIENT_ID,
        teamId: this.env.APPLE_TEAM_ID,
        keyId: this.env.APPLE_KEY_ID,
        privateKey: this.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      microsoft: {
        clientId: this.env.MICROSOFT_CLIENT_ID,
        clientSecret: this.env.MICROSOFT_CLIENT_SECRET,
        tenantId: this.env.MICROSOFT_TENANT_ID,
      },
    };
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

  get llmSummary(): {
    baseUrl: string;
    apiKey: string;
    model: string;
    timeoutMs: number;
    configured: boolean;
  } {
    return {
      baseUrl: this.env.USER_LLM_BASE_URL,
      apiKey: this.env.USER_LLM_API_KEY,
      model: this.env.USER_LLM_MODEL,
      timeoutMs: this.env.LLM_SUMMARY_TIMEOUT_MS,
      configured: this.env.USER_LLM_BASE_URL.length > 0,
    };
  }

  get storageDir(): string {
    return this.env.STORAGE_DIR;
  }

  get outbox(): {
    relayEnabled: boolean;
    pollIntervalMs: number;
    batchSize: number;
    webhookUrl: string;
  } {
    return {
      relayEnabled: this.env.OUTBOX_RELAY_ENABLED && !this.isTest,
      pollIntervalMs: this.env.OUTBOX_POLL_INTERVAL_MS,
      batchSize: this.env.OUTBOX_BATCH_SIZE,
      webhookUrl: this.env.EVENT_WEBHOOK_URL,
    };
  }

  get memoryWorker(): {
    enabled: boolean;
    intervalMs: number;
    batchSize: number;
  } {
    return {
      enabled: this.env.MEMORY_WORKER_ENABLED && !this.isTest,
      intervalMs: this.env.MEMORY_WORKER_INTERVAL_MS,
      batchSize: this.env.MEMORY_WORKER_BATCH_SIZE,
    };
  }

  /**
   * Whether an optional memory capability is configured. A missing endpoint is
   * an explicit "not available" signal: jobs that need it become BLOCKED and
   * visible to an administrator instead of being reported as successful.
   */
  get memoryCapabilities(): { ocr: boolean; transcription: boolean } {
    return {
      ocr: this.env.MEMORY_OCR_ENDPOINT.length > 0,
      transcription: this.env.MEMORY_STT_ENDPOINT.length > 0,
    };
  }

  get notifications(): {
    emailFrom: string;
    resendApiKey: string;
    smsFrom: string;
    twilioAccountSid: string;
    twilioAuthToken: string;
  } {
    return {
      emailFrom: this.env.EMAIL_FROM_ADDRESS,
      resendApiKey: this.env.RESEND_API_KEY,
      smsFrom: this.env.SMS_FROM_NUMBER,
      twilioAccountSid: this.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: this.env.TWILIO_AUTH_TOKEN,
    };
  }
}
