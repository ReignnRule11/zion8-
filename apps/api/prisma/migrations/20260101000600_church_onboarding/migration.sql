-- Church onboarding: workspace profile, invitations, subscription, branding,
-- and first member import.
--
-- Every new table is tenant-scoped and therefore FORCE ROW LEVEL SECURITY, the
-- same posture as the rest of the schema. Onboarding is read and written by
-- church administrators in their own workspace; the only cross-tenant reader is
-- the pre-authentication invitation-acceptance path, which runs under the
-- explicit platform-admin scope (see tenant_invitations below).

-- Enums ---------------------------------------------------------------------
CREATE TYPE "OnboardingStep" AS ENUM ('REGISTRATION', 'EMAIL_VERIFICATION', 'TENANT_PROVISIONING', 'WORKSPACE_CREATION', 'ADMINISTRATOR_INVITATION', 'SUBSCRIPTION_SELECTION', 'BRAND_CUSTOMIZATION', 'FIRST_MEMBER_IMPORT', 'DASHBOARD_READY');
CREATE TYPE "OnboardingStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');
CREATE TYPE "OnboardingStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'FAILED');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'STANDARD', 'GROWTH', 'MULTISITE');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');
CREATE TYPE "MemberImportStatus" AS ENUM ('READY', 'IMPORTING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- Invitations reuse the shared verification-challenge primitive, so the purpose
-- enum needs the new value before any invitation can be issued.
ALTER TYPE "ChallengePurpose" ADD VALUE 'INVITATION';

-- Tables --------------------------------------------------------------------
CREATE TABLE "tenant_onboardings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "current_step" "OnboardingStep" NOT NULL DEFAULT 'REGISTRATION',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_onboardings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_onboarding_steps" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "step" "OnboardingStep" NOT NULL,
    "status" "OnboardingStepStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_onboarding_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "church_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "legal_name" VARCHAR(160),
    "contact_email" VARCHAR(320),
    "contact_phone" VARCHAR(32),
    "website_url" VARCHAR(2048),
    "address_line1" VARCHAR(180),
    "address_line2" VARCHAR(180),
    "city" VARCHAR(120),
    "region" VARCHAR(120),
    "postal_code" VARCHAR(32),
    "country_code" VARCHAR(2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "week_start" VARCHAR(9) NOT NULL DEFAULT 'SUNDAY',
    "estimated_members" INTEGER,
    "service_times" JSONB NOT NULL DEFAULT '[]',
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "church_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_invitations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "first_name" VARCHAR(120),
    "last_name" VARCHAR(120),
    "role" "Role" NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invited_by_user_id" UUID,
    "accepted_user_id" UUID,
    "challenge_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "last_sent_at" TIMESTAMP(3) NOT NULL,
    "resend_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_invitations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "seats" INTEGER,
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "selected_by_user_id" UUID,
    "trial_ends_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_themes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "display_name" VARCHAR(120),
    "tagline" VARCHAR(160),
    "logo_url" VARCHAR(2048),
    "favicon_url" VARCHAR(2048),
    "primary_color" VARCHAR(7) NOT NULL DEFAULT '#4f46e5',
    "secondary_color" VARCHAR(7) NOT NULL DEFAULT '#0f172a',
    "accent_color" VARCHAR(7) NOT NULL DEFAULT '#38bdf8',
    "custom_domain" VARCHAR(253),
    "welcome_message" VARCHAR(600),
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_themes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "member_import_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" "MemberImportStatus" NOT NULL DEFAULT 'READY',
    "file_name" VARCHAR(255),
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "skipped_rows" INTEGER NOT NULL DEFAULT 0,
    "duplicate_rows" INTEGER NOT NULL DEFAULT 0,
    "resume_index" INTEGER NOT NULL DEFAULT 0,
    "rows" JSONB NOT NULL DEFAULT '[]',
    "issues" JSONB NOT NULL DEFAULT '[]',
    "created_by_user_id" UUID,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_import_jobs_pkey" PRIMARY KEY ("id")
);

-- Indexes -------------------------------------------------------------------
CREATE UNIQUE INDEX "tenant_onboardings_tenant_id_key" ON "tenant_onboardings"("tenant_id");
CREATE INDEX "tenant_onboarding_steps_tenant_id_status_idx" ON "tenant_onboarding_steps"("tenant_id", "status");
CREATE UNIQUE INDEX "tenant_onboarding_steps_tenant_id_step_key" ON "tenant_onboarding_steps"("tenant_id", "step");
CREATE UNIQUE INDEX "church_profiles_tenant_id_key" ON "church_profiles"("tenant_id");
CREATE INDEX "tenant_invitations_tenant_id_status_idx" ON "tenant_invitations"("tenant_id", "status");
CREATE INDEX "tenant_invitations_email_idx" ON "tenant_invitations"("email");
CREATE UNIQUE INDEX "tenant_invitations_tenant_id_email_key" ON "tenant_invitations"("tenant_id", "email");
CREATE UNIQUE INDEX "tenant_subscriptions_tenant_id_key" ON "tenant_subscriptions"("tenant_id");
CREATE UNIQUE INDEX "brand_themes_tenant_id_key" ON "brand_themes"("tenant_id");
CREATE INDEX "member_import_jobs_tenant_id_created_at_idx" ON "member_import_jobs"("tenant_id", "created_at");
CREATE INDEX "member_import_jobs_tenant_id_status_idx" ON "member_import_jobs"("tenant_id", "status");

-- Foreign keys --------------------------------------------------------------
ALTER TABLE "tenant_onboardings" ADD CONSTRAINT "tenant_onboardings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_onboarding_steps" ADD CONSTRAINT "tenant_onboarding_steps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_onboardings"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "church_profiles" ADD CONSTRAINT "church_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_accepted_user_id_fkey" FOREIGN KEY ("accepted_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_selected_by_user_id_fkey" FOREIGN KEY ("selected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "brand_themes" ADD CONSTRAINT "brand_themes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_import_jobs" ADD CONSTRAINT "member_import_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_import_jobs" ADD CONSTRAINT "member_import_jobs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security --------------------------------------------------------
--   app.current_tenant     -> uuid of the active church workspace ('' when unset)
--   app.is_platform_admin  -> 'true' for trusted system operations
--
-- Invitation acceptance happens before the invitee has a session, so the token
-- lookup runs under the platform-admin scope; the service then binds the tenant
-- from the invitation record before writing the membership.

ALTER TABLE "tenant_onboardings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_onboardings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_onboardings_tenant_isolation" ON "tenant_onboardings"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "tenant_onboarding_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_onboarding_steps" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_onboarding_steps_tenant_isolation" ON "tenant_onboarding_steps"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "church_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "church_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "church_profiles_tenant_isolation" ON "church_profiles"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "tenant_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_invitations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_invitations_tenant_isolation" ON "tenant_invitations"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

-- An invitee reads and accepts their invitation through the pre-authentication
-- platform-admin scope; once a membership exists they read it under the tenant
-- policy above like any other workspace member.

ALTER TABLE "tenant_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_subscriptions_tenant_isolation" ON "tenant_subscriptions"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "brand_themes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brand_themes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "brand_themes_tenant_isolation" ON "brand_themes"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "member_import_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_import_jobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "member_import_jobs_tenant_isolation" ON "member_import_jobs"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
