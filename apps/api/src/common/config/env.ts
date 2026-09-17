import { AI_VECTOR_DIMENSIONS } from '@zion8/contracts';
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

/**
 * Environment values are always strings, so `z.coerce.boolean()` would treat
 * the string "false" as truthy. Only the exact strings "true" and "false" are
 * accepted, which makes a typo a startup failure rather than a silent default.
 */
const booleanString = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

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
  INVITATION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
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

  // Member AI summaries. When no base URL is configured the deterministic
  // rule-based provider is used, which needs no network access. These are
  // project-owned variables: the workspace supplies its own provider key.
  USER_LLM_BASE_URL: z.string().default(''),
  USER_LLM_API_KEY: z.string().default(''),
  USER_LLM_MODEL: z.string().default(''),
  LLM_SUMMARY_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),

  // Member documents and memory artifacts. Bytes are written to this directory
  // under development; production points the same port at object storage.
  STORAGE_DIR: z.string().default('/tmp/zion8-storage'),

  // Integration events. The transactional outbox is always written; the relay
  // that drains it publishes either to the log (development default) or to a
  // webhook endpoint when one is configured.
  OUTBOX_RELAY_ENABLED: booleanString('true'),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(2000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),
  EVENT_WEBHOOK_URL: z.string().default(''),

  // Memory processing. Jobs are claimed with SKIP LOCKED by a poller. The worker
  // can be disabled in tests so background timers never race assertions.
  MEMORY_WORKER_ENABLED: booleanString('true'),
  MEMORY_WORKER_INTERVAL_MS: z.coerce.number().int().min(250).default(5000),
  MEMORY_WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),

  // Optional memory providers. An empty endpoint means the capability is not
  // configured, and jobs that require it are BLOCKED rather than silently
  // skipped.
  MEMORY_OCR_ENDPOINT: z.string().default(''),
  MEMORY_STT_ENDPOINT: z.string().default(''),

  // Zion AI. The default embedding provider is a deterministic local projection
  // and the default answer provider is extractive, so retrieval and grounded
  // answers work with no key. An HTTP provider is opt-in per workspace.
  AI_ENABLED: booleanString('true'),
  AI_EMBEDDING_PROVIDER: z.string().default('deterministic'),
  AI_EMBEDDING_MODEL: z.string().default(''),
  AI_EMBEDDING_BASE_URL: z.string().default(''),
  AI_EMBEDDING_API_KEY: z.string().default(''),
  // Must equal the width of the stored vector column (AI_VECTOR_DIMENSIONS).
  // The assertion is deliberate: a mismatch would only surface as a failed
  // insert at index time, far from the cause.
  AI_EMBEDDING_DIMENSIONS: z.coerce
    .number()
    .int()
    .refine((value) => value === AI_VECTOR_DIMENSIONS, {
      message: `AI_EMBEDDING_DIMENSIONS must be ${AI_VECTOR_DIMENSIONS}; changing it requires a migration`,
    })
    .default(AI_VECTOR_DIMENSIONS),
  AI_CHAT_PROVIDER: z.string().default(''),
  AI_CHAT_MODEL: z.string().default(''),
  AI_CHAT_BASE_URL: z.string().default(''),
  AI_CHAT_API_KEY: z.string().default(''),
  AI_RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(50).default(10),
  AI_RETRIEVAL_CANDIDATES: z.coerce.number().int().min(1).max(200).default(50),
  // Minimum share of claims that must carry a valid citation before an answer is
  // presented as fact. Below the threshold the answer abstains. See ADR 0002.
  AI_CITATION_MIN_SUPPORT: z.coerce.number().min(0).max(1).default(0.5),
  AI_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  AI_INSIGHT_MIN_COHORT: z.coerce.number().int().min(3).max(50).default(5),
  AI_WORKER_ENABLED: booleanString('true'),
  AI_WORKER_INTERVAL_MS: z.coerce.number().int().min(250).default(5000),
  AI_WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),

  SERMON_WORKER_ENABLED: booleanString('true'),
  SERMON_WORKER_INTERVAL_MS: z.coerce.number().int().min(250).default(5000),
  SERMON_WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // A test runner is always a test environment, even when the checked-in `.env`
  // says `development`. This keeps background pollers (outbox relay, memory
  // worker) from racing assertions or outliving the test database connection;
  // tests that need them drive the drain/runOnce methods directly.
  const input = source.VITEST ? { ...source, NODE_ENV: 'test' as const } : source;
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration -> ${detail}`);
  }
  return result.data;
}
