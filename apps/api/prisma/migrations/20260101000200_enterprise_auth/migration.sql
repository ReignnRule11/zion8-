-- Enterprise authentication: identity, credentials, sessions, challenges, MFA.
-- Data-preserving: existing users and refresh tokens are migrated in place.
--
-- The backfill below reads `refresh_tokens`, which already has FORCE ROW LEVEL
-- SECURITY from the previous migration. The migration runs as the schema owner,
-- which is neither superuser nor BYPASSRLS, so the policies apply to it too and
-- an unscoped read would silently return zero rows (leaving the new foreign key
-- with orphaned tokens to reject). RLS is therefore lifted for the duration of
-- that one read and restored immediately afterwards. `FORCE ROW LEVEL SECURITY`
-- is a separate flag and is left untouched.

-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('EMAIL', 'PHONE', 'GOOGLE', 'APPLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "ChallengePurpose" AS ENUM ('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'MAGIC_LINK', 'EMAIL_OTP', 'SMS_OTP', 'CHANGE_EMAIL', 'CHANGE_PHONE');

-- CreateEnum
CREATE TYPE "MfaFactorType" AS ENUM ('TOTP', 'WEBAUTHN');

-- CreateEnum
CREATE TYPE "MfaFactorStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AssuranceLevel" AS ENUM ('AAL1', 'AAL2', 'AAL3');

-- AlterTable: users gain a phone contact and lose the inline password hash.
ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(32);
ALTER TABLE "users" ADD COLUMN "phone_verified_at" TIMESTAMP(3);
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- A user must remain reachable through at least one contact.
ALTER TABLE "users" ADD CONSTRAINT "users_contact_required_check"
  CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);

-- CreateTable: password becomes a credential rather than a user column.
CREATE TABLE "password_credentials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "algorithm" VARCHAR(32) NOT NULL DEFAULT 'argon2id',
    "needs_rehash" BOOLEAN NOT NULL DEFAULT false,
    "password_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_credentials_pkey" PRIMARY KEY ("id")
);

-- Migrate existing password hashes before dropping the column.
INSERT INTO "password_credentials" ("id", "user_id", "password_hash", "algorithm", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", "password_hash", 'argon2id', "created_at", "updated_at"
FROM "users"
WHERE "password_hash" IS NOT NULL AND "password_hash" <> '';

ALTER TABLE "users" DROP COLUMN "password_hash";

-- CreateTable: a real session, distinct from the tokens rotating inside it.
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "assurance_level" "AssuranceLevel" NOT NULL DEFAULT 'AAL1',
    "device_name" VARCHAR(120),
    "user_agent" VARCHAR(512),
    "ip_address" VARCHAR(64),
    "mfa_satisfied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_authenticated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" VARCHAR(120),

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- Backfill sessions from the existing refresh-token families, which already
-- behaved as sessions. The family id becomes the session id.
ALTER TABLE "refresh_tokens" DISABLE ROW LEVEL SECURITY;

INSERT INTO "auth_sessions" (
    "id", "user_id", "tenant_id", "status", "assurance_level",
    "created_at", "last_seen_at", "last_authenticated_at", "expires_at"
)
SELECT
    "family_id",
    "user_id",
    "tenant_id",
    CASE WHEN bool_or("revoked_at" IS NULL) THEN 'ACTIVE'::"SessionStatus" ELSE 'REVOKED'::"SessionStatus" END,
    'AAL1'::"AssuranceLevel",
    MIN("created_at"),
    MAX("created_at"),
    MAX("created_at"),
    MAX("expires_at")
FROM "refresh_tokens"
GROUP BY "family_id", "user_id", "tenant_id";

ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" FORCE ROW LEVEL SECURITY;

-- AlterTable: refresh tokens now hang off a session.
ALTER TABLE "refresh_tokens" RENAME COLUMN "family_id" TO "session_id";
DROP INDEX IF EXISTS "refresh_tokens_family_id_idx";

-- CreateTable: one row per way a user can authenticate.
CREATE TABLE "user_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "provider_account_id" VARCHAR(320) NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(32),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "profile" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

-- Backfill an EMAIL identity for every existing user.
INSERT INTO "user_identities" (
    "id", "user_id", "provider", "provider_account_id", "email",
    "is_primary", "verified_at", "created_at"
)
SELECT
    gen_random_uuid(),
    "id",
    'EMAIL'::"IdentityProvider",
    "email",
    "email",
    true,
    "email_verified_at",
    "created_at"
FROM "users"
WHERE "email" IS NOT NULL;

-- CreateTable: shared lifecycle for every verification and one-time code.
CREATE TABLE "verification_challenges" (
    "id" UUID NOT NULL,
    "purpose" "ChallengePurpose" NOT NULL,
    "user_id" UUID,
    "tenant_id" UUID,
    "identifier" VARCHAR(320) NOT NULL,
    "secret_hash" VARCHAR(128) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_factors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "MfaFactorType" NOT NULL,
    "status" "MfaFactorStatus" NOT NULL DEFAULT 'PENDING',
    "name" VARCHAR(120) NOT NULL,
    "secret_ciphertext" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webauthn_credentials" (
    "id" UUID NOT NULL,
    "factor_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "credential_id" VARCHAR(512) NOT NULL,
    "public_key" BYTEA NOT NULL,
    "sign_count" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aaguid" VARCHAR(64),
    "device_type" VARCHAR(32),
    "backed_up" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_credentials_user_id_key" ON "password_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_provider_account_id_key" ON "user_identities"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "user_identities_user_id_idx" ON "user_identities"("user_id");

-- CreateIndex
CREATE INDEX "user_identities_email_idx" ON "user_identities"("email");

-- CreateIndex
CREATE INDEX "verification_challenges_user_id_purpose_idx" ON "verification_challenges"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "verification_challenges_identifier_purpose_idx" ON "verification_challenges"("identifier", "purpose");

-- CreateIndex
CREATE INDEX "verification_challenges_expires_at_idx" ON "verification_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "mfa_factors_user_id_status_idx" ON "mfa_factors"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "webauthn_credentials_credential_id_key" ON "webauthn_credentials"("credential_id");

-- CreateIndex
CREATE UNIQUE INDEX "webauthn_credentials_factor_id_key" ON "webauthn_credentials"("factor_id");

-- CreateIndex
CREATE INDEX "webauthn_credentials_user_id_idx" ON "webauthn_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_recovery_codes_code_hash_key" ON "mfa_recovery_codes"("code_hash");

-- CreateIndex
CREATE INDEX "mfa_recovery_codes_user_id_used_at_idx" ON "mfa_recovery_codes"("user_id", "used_at");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_status_idx" ON "auth_sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "auth_sessions_tenant_id_idx" ON "auth_sessions"("tenant_id");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- AddForeignKey
ALTER TABLE "password_credentials" ADD CONSTRAINT "password_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "mfa_factors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
