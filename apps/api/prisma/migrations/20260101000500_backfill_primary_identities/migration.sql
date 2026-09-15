-- Heal any user that predates the identity migration and therefore has no
-- primary identity row. Without this, a user could authenticate before the
-- migration but not after it, because login resolves through user_identities.
--
-- `user_identities` is protected by FORCE ROW LEVEL SECURITY, which applies to
-- the schema owner too, so RLS is lifted for the duration of these two writes
-- and restored immediately afterwards. Setting a session variable is not used
-- here because it is not guaranteed to survive across statements under the
-- migration runner. `FORCE ROW LEVEL SECURITY` is a separate flag and is left
-- untouched by DISABLE/ENABLE ROW LEVEL SECURITY.

ALTER TABLE "user_identities" DISABLE ROW LEVEL SECURITY;

-- Users reachable by email.
INSERT INTO "user_identities" (
    "id", "user_id", "provider", "provider_account_id", "email",
    "is_primary", "verified_at", "created_at"
)
SELECT
    gen_random_uuid(),
    u."id",
    'EMAIL'::"IdentityProvider",
    u."email",
    u."email",
    true,
    u."email_verified_at",
    u."created_at"
FROM "users" u
WHERE u."email" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "user_identities" i
    WHERE i."user_id" = u."id" AND i."provider" = 'EMAIL'::"IdentityProvider"
  );

-- Users reachable by phone only.
INSERT INTO "user_identities" (
    "id", "user_id", "provider", "provider_account_id", "phone",
    "is_primary", "verified_at", "created_at"
)
SELECT
    gen_random_uuid(),
    u."id",
    'PHONE'::"IdentityProvider",
    u."phone",
    u."phone",
    true,
    u."phone_verified_at",
    u."created_at"
FROM "users" u
WHERE u."phone" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "user_identities" i
    WHERE i."user_id" = u."id" AND i."provider" = 'PHONE'::"IdentityProvider"
  );

ALTER TABLE "user_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_identities" FORCE ROW LEVEL SECURITY;
