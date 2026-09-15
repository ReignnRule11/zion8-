-- Row-Level Security for the enterprise authentication tables.
--
-- Identity resolution is inherently pre-authentication: login must map an
-- identifier to a user before a tenant or user context exists. Those system
-- operations therefore run under the explicit platform-admin scope, while all
-- self-service reads and writes are additionally constrained by the policies
-- below so that a bug in a service cannot expose another user's data.
--
--   app.current_tenant     -> uuid of the active church workspace ('' when unset)
--   app.current_user       -> uuid of the authenticated user ('' when unset)
--   app.is_platform_admin  -> 'true' for trusted system operations

-- password_credentials -------------------------------------------------------
ALTER TABLE "password_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_credentials" FORCE ROW LEVEL SECURITY;

CREATE POLICY "password_credentials_self_access" ON "password_credentials"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid
  );

-- user_identities ------------------------------------------------------------
ALTER TABLE "user_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_identities" FORCE ROW LEVEL SECURITY;

CREATE POLICY "user_identities_self_access" ON "user_identities"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid
  );

-- auth_sessions --------------------------------------------------------------
ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_sessions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "auth_sessions_self_access" ON "auth_sessions"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid
  );

-- Tenant administrators may audit the sessions of their own workspace.
CREATE POLICY "auth_sessions_tenant_isolation" ON "auth_sessions"
  FOR SELECT
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

-- verification_challenges ----------------------------------------------------
ALTER TABLE "verification_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_challenges" FORCE ROW LEVEL SECURITY;

CREATE POLICY "verification_challenges_self_access" ON "verification_challenges"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid
  );

CREATE POLICY "verification_challenges_tenant_isolation" ON "verification_challenges"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

-- mfa_factors ----------------------------------------------------------------
ALTER TABLE "mfa_factors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mfa_factors" FORCE ROW LEVEL SECURITY;

CREATE POLICY "mfa_factors_self_access" ON "mfa_factors"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid
  );

-- webauthn_credentials -------------------------------------------------------
ALTER TABLE "webauthn_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webauthn_credentials" FORCE ROW LEVEL SECURITY;

CREATE POLICY "webauthn_credentials_self_access" ON "webauthn_credentials"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid
  );

-- mfa_recovery_codes ---------------------------------------------------------
ALTER TABLE "mfa_recovery_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mfa_recovery_codes" FORCE ROW LEVEL SECURITY;

CREATE POLICY "mfa_recovery_codes_self_access" ON "mfa_recovery_codes"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid
  );

-- refresh_tokens: the tenancy policies from the previous migration reference
-- "family_id", which has been renamed to "session_id". Recreate them so the
-- token table keeps enforcing self access and tenant isolation.
DROP POLICY IF EXISTS "refresh_tokens_tenant_isolation" ON "refresh_tokens";
DROP POLICY IF EXISTS "refresh_tokens_self_access" ON "refresh_tokens";

CREATE POLICY "refresh_tokens_tenant_isolation" ON "refresh_tokens"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

CREATE POLICY "refresh_tokens_self_access" ON "refresh_tokens"
  FOR ALL
  USING ("user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid)
  WITH CHECK ("user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid);
