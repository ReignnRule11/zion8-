import { z } from 'zod';

const commaSeparated = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_GLOBAL_PREFIX: z.string().min(1).max(32).default('api'),
  API_VERSION: z.string().min(1).max(16).default('1'),
  APP_BASE_URL: z.string().url(),
  WEB_BASE_URL: z.string().url(),
  CORS_ORIGINS: commaSeparated,

  DATABASE_URL: z.string().min(1),
  MIGRATION_DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  ARGON2_MEMORY_COST: z.coerce.number().int().min(8).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(2).max(20).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).max(16).default(1),

  // 32-byte AES-256 key, base64-encoded. Encrypts MFA secrets at rest.
  ENCRYPTION_KEY: z
    .string()
    .min(1, 'ENCRYPTION_KEY is required')
    .refine((value) => Buffer.from(value, 'base64').length === 32, {
      message: 'ENCRYPTION_KEY must be a base64-encoded 32-byte key',
    }),

  VERIFICATION_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  MAGIC_LINK_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  MFA_CHALLENGE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  TOTP_ISSUER: z.string().min(1).max(64).default('Zion8'),
  WEBAUTHN_RP_ID: z.string().min(1).max(253).default('localhost'),
  WEBAUTHN_RP_NAME: z.string().min(1).max(120).default('Zion8'),
  WEBAUTHN_ORIGINS: commaSeparated,

  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  APPLE_CLIENT_ID: z.string().default(''),
  APPLE_TEAM_ID: z.string().default(''),
  APPLE_KEY_ID: z.string().default(''),
  APPLE_PRIVATE_KEY: z.string().default(''),
  MICROSOFT_CLIENT_ID: z.string().default(''),
  MICROSOFT_CLIENT_SECRET: z.string().default(''),
  MICROSOFT_TENANT_ID: z.string().default('common'),

  // Notification delivery. When a provider is not configured the logging
  // adapter is used, which never sends mail or SMS outside development.
  EMAIL_FROM_ADDRESS: z.string().default('no-reply@zion8.local'),
  RESEND_API_KEY: z.string().default(''),
  SMS_FROM_NUMBER: z.string().default(''),
  TWILIO_ACCOUNT_SID: z.string().default(''),
  TWILIO_AUTH_TOKEN: z.string().default(''),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration -> ${detail}`);
  }
  return result.data;
}
