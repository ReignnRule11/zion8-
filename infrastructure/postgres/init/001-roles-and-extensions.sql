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

-- The application role must be able to use every table and sequence that the
-- migration owner creates from now on. Row-Level Security, not a missing
-- GRANT, is what constrains what the application can actually see.
ALTER DEFAULT PRIVILEGES FOR ROLE zion8 IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO zion8_app;
ALTER DEFAULT PRIVILEGES FOR ROLE zion8 IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO zion8_app;

-- Tables created before this rule existed still need explicit grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zion8_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO zion8_app;
