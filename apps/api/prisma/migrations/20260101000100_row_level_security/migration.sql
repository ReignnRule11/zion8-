-- Row-Level Security for tenant-scoped tables.
-- `tenants` and `users` are intentionally global (platform registry) and remain without RLS.
-- The application connects with a dedicated, non-superuser role that has NOBYPASSRLS.
-- Per-request context is injected inside a transaction via set_config(..., is_local => true):
--   app.current_tenant     -> uuid of the active church workspace ('' when unset)
--   app.current_user       -> uuid of the authenticated user ('' when unset)
--   app.is_platform_admin  -> 'true' for platform-level operations

ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;

CREATE POLICY "memberships_tenant_isolation" ON "memberships"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

CREATE POLICY "memberships_self_access" ON "memberships"
  FOR SELECT
  USING ("user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid);

ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" FORCE ROW LEVEL SECURITY;

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

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_tenant_isolation" ON "audit_logs"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
