# Multi-Tenancy in Zion8

Zion8 serves many churches from a single deployment. Tenant isolation is the highest-severity
concern in the system: a leak between churches is not a bug, it is a breach of trust that
cannot be undone. This document explains how isolation is guaranteed.

## Model: shared database, enforced by the database

Zion8 uses a **shared database with a shared schema** and enforces isolation with PostgreSQL
**Row-Level Security (RLS)**.

The alternatives and why they were rejected:

| Alternative | Why not |
| --- | --- |
| Database per tenant | Connection and migration fan-out grows with every church; cross-tenant reporting and platform administration become painful. |
| Schema per tenant | Same migration fan-out, plus connection-pool pressure and awkward shared reference data. |
| Shared schema, application-enforced `WHERE` clauses | One forgotten predicate leaks data. Correctness depends on every developer, forever, including in raw SQL and future migrations. |

RLS keeps the simplicity of a shared schema while moving enforcement into the engine. The
application cannot forget the tenant predicate, because the engine adds it.

## Two database roles

| Role | Used by | Privileges |
| --- | --- | --- |
| `zion8` | Migrations and schema ownership | Owns the schema, bypasses RLS |
| `zion8_app` | The running application | `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT` **`NOBYPASSRLS`** |

The application never connects as the schema owner. `NOBYPASSRLS` is the load-bearing detail:
without it, a table owner silently ignores its own policies, and the entire model collapses into
application-enforced filtering.

This is why the Prisma datasource is split:

- `MIGRATION_DATABASE_URL` (owner) is used by the Prisma CLI.
- `DATABASE_URL` (`zion8_app`) is used by the running application.

## Session context

Policies read three session settings:

| Setting | Meaning |
| --- | --- |
| `app.current_tenant` | The tenant id for the current request |
| `app.current_user` | The authenticated user id |
| `app.is_platform_admin` | Whether platform-wide access is granted |

These are set with `SET LOCAL` / `set_config(..., true)` inside the request's transaction, so
they are scoped to that transaction and cannot leak to another request that later reuses the
same pooled connection. `PrismaService` exposes `withTenant`, `withScope`, and `withoutScope`
helpers that open the transaction and apply the context atomically.

Because the context is transaction-scoped, **every tenant-scoped query must run inside a
transaction**. This is intentional: it makes the scope explicit at the call site and prevents
accidental reuse of a connection carrying a previous tenant's context.

## Policy shape

Three patterns cover the current schema:

1. **Tenant isolation** — rows are visible only when `tenant_id` matches `app.current_tenant`.
   Applied to `memberships`, `refresh_tokens`, and `audit_logs`.
2. **Self access** — a user may always see their own rows (for example their own memberships and
   refresh tokens), even outside a tenant context. This is required for sign-in, where the
   tenant is not yet known.
3. **Platform administration** — `app.is_platform_admin` widens visibility for support and
   platform-level reporting.

Policies exist for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`. `FORCE ROW LEVEL SECURITY` is
enabled on every tenant-scoped table so that even the table owner is subject to policies during
migrations and maintenance, removing an entire class of accidental exposure.

`tenants` and `users` are intentionally **global**, not tenant-scoped: a person may belong to
more than one church, and tenant records must be resolvable before a tenant context exists.

## Default deny

With RLS enabled and no matching policy — or no session context at all — the result set is
empty and writes are rejected. A request that forgets to establish context sees nothing rather
than everything. This fail-closed behavior is the property that makes RLS worth the operational
cost.

## Sign-in and tenant resolution

Authentication is the one flow that intentionally runs before a tenant is known:

1. The user authenticates with email and password.
2. The user's memberships are read under **self access**, not tenant isolation.
3. If the user belongs to exactly one active church, that tenant becomes the session's active
   tenant. If they belong to several, the login must specify a workspace, or the API returns the
   list and requires an explicit selection.
4. A tenant context is then established and the access token carries the tenant and role.

Refresh tokens are scoped to both the user and the tenant, so a session can never be silently
elevated into a different church.

## Testing isolation

Distributed security cannot be verified by reasoning alone, so isolation is covered by
end-to-end tests that run against a real database with RLS active:

- Queries without context return nothing (default deny).
- A tenant-scoped query returns only the active tenant's rows.
- A self-scoped query returns only the caller's rows.
- An insert carrying another tenant's id is rejected by the database.
- A rotated refresh token is rejected on reuse, and the token family is revoked.

These tests exercise the database, not a mock, because a mock cannot prove that the engine
enforces a policy.
