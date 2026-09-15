-- The challenge secret must be unique so a token hash can only ever resolve to
-- a single challenge row.
CREATE UNIQUE INDEX "verification_challenges_secret_hash_key"
  ON "verification_challenges"("secret_hash");
