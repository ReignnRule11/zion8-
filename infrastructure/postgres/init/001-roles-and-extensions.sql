-- Zion8 local development bootstrap.
-- Runs once on first container start, before the schema migrations.

-- The migration owner owns the schema objects.
CREATE ROLE zion8_app WITH LOGIN PASSWORD 'zion8-app-dev-password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

-- pgvector backs AI memory embeddings.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

GRANT CONNECT ON DATABASE zion8 TO zion8_app;
GRANT USAGE ON SCHEMA public TO zion8_app;
