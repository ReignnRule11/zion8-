# Zion8

An AI-powered multi-tenant **Digital Memory & Operating System for Churches**.

Zion8 is not another church management system. It runs the daily operations of ministry while
preserving the institutional knowledge of the church, so that history is never lost between
generations.

> **Preserve the Past. Empower the Present. Inspire the Future.**

## Why Zion8 exists

Most church software is a database of the present: who is a member, what is in the calendar,
where the money went. When staff turn over, decades of sermons, decisions, testimonies, and
institutional knowledge walk out of the door. Zion8 treats **memory as a first-class product
concern**, not an afterthought.

Every feature must serve at least one of five goals:

1. Preserve church history.
2. Strengthen community.
3. Simplify operations.
4. Organize institutional knowledge.
5. Enable AI-powered discovery.

## Vision and scope

Zion8 is a platform, not a single application. Planned product modules:

| Domain | Modules |
| --- | --- |
| Identity & tenancy | Multi-tenant SaaS, authentication, church workspace |
| Operations | Membership, attendance, events, ministries, volunteers, giving, accounting |
| Care | Prayer, counseling |
| Memory | Sermons, AI memory, digital archives |
| Presence | Website builder |
| Platform | Notifications, reports, analytics |

## Architecture

Zion8 is built as a **cloud-native, API-first, event-driven, multi-tenant modular monolith**
that is structured for later extraction into microservices.

- **Domain-Driven Design** with bounded contexts (`auth`, `tenancy`, and later `membership`,
  `giving`, `memory`, `ai`).
- **Clean Architecture** per module: domain and application logic independent of transport,
  persistence, and framework concerns.
- **PostgreSQL as the system of record**, Redis for sessions and caching, OpenSearch for
  full-text search, `pgvector` for embeddings, and S3-compatible object storage for archives.
- **Transactional outbox** for reliable domain events, published to NATS JetStream.
- **Multi-tenancy** via a shared database with PostgreSQL Row-Level Security, so tenant
  isolation is enforced by the database rather than by application discipline.

See `docs/architecture/ARCHITECTURE.md` for the detailed design,
`docs/architecture/MULTI_TENANCY.md` for the isolation model,
`docs/architecture/AUTHENTICATION.md` for the enterprise authentication model,
`docs/architecture/CHURCH_ONBOARDING.md` for the church onboarding journey,
`docs/architecture/MEMBERSHIP.md` for the membership domain, and
`docs/architecture/REPOSITORY_STRUCTURE.md` for how the repository is organized, worked in, and
scaled.

## Repository layout

```
apps/
  api/                 NestJS API (modular monolith, versioned under /api/v1)
  web/                 Next.js 15 App Router frontend
packages/
  contracts/           Canonical Zod schemas shared by every client
  config/              Shared TypeScript configuration presets
infrastructure/
  postgres/init/       Local database roles and extensions
docs/                  Architecture and operational documentation
```

The Flutter mobile application is intentionally decoupled from the TypeScript workspace. It
consumes the same versioned HTTP API through generated clients.

## Getting started

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL 15+ with the `vector`, `pgcrypto`, and `citext` extensions
- Redis 7+

### Install

```bash
# Install workspace dependencies
pnpm install
```

### Configure

```bash
# Copy the API environment template and fill in the secrets
cp apps/api/.env.example apps/api/.env

# Copy the web environment template
cp apps/web/.env.example apps/web/.env.local
```

### Provision the database

```bash
# Create the application role and extensions
psql -h localhost -U zion8 -d zion8 -f infrastructure/postgres/init/001-roles-and-extensions.sql

# Apply the schema and Row-Level Security policies
pnpm --filter @zion8/api prisma:migrate
```

### Run

```bash
# Start every app in watch mode
pnpm dev
```

- API: http://localhost:4000/api/v1
- Web: http://localhost:3000

### Verify

```bash
# Typecheck, lint, build and unit test everything
pnpm turbo run build typecheck lint test

# End-to-end auth and tenant-isolation tests against real Postgres and Redis
pnpm --filter @zion8/api test:e2e
```

### Infrastructure with Docker

```bash
# Start Postgres (with pgvector), Redis and OpenSearch
docker compose up -d
```

## Roadmap

| Phase | Theme | Focus |
| --- | --- | --- |
| 0 | Foundation | Monorepo, contracts, auth, tenancy, RLS, CI |
| 1 | Operations MVP | Membership, attendance, events, giving |
| 2 | Memory & Archives | Sermons, documents, digital archives, search |
| 3 | Community | Ministries, volunteers, prayer, counseling |
| 4 | Intelligence & Scale | AI memory, semantic discovery, analytics |

## Status

Phase 0 foundation is in place: the identity and tenancy bounded contexts are implemented with
Row-Level Security enforcement, refresh-token rotation with reuse detection, and end-to-end
tests covering cross-tenant isolation.

The church onboarding journey is implemented end to end: a new church registers, verifies its
email, is provisioned automatically, and then completes workspace creation, administrator
invitations, subscription selection, brand customization, and first member import from the web
wizard. The journey is a projection of persisted facts, so it is resumable, retryable, and
skippable without losing its place.

A Flutter client ships the enterprise authentication flows against the same versioned API.
