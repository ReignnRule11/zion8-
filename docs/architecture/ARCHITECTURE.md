# Zion8 Architecture

This document describes how Zion8 is structured, why those choices were made, and where the
boundaries between the current implementation and future extraction points lie.

## Guiding constraints

1. **Memory is a product, not a feature.** Every subsystem must be able to preserve and retrieve
   institutional knowledge. This drives the choice of append-only archives, an event log, and a
   vector store for semantic retrieval.
2. **Multi-tenancy is a database guarantee.** A single missed `WHERE tenant_id = ...` must not be
   able to leak data across churches, so isolation is enforced by PostgreSQL Row-Level Security.
3. **Production code only.** There are no demo stubs. If a path exists in the codebase, it is
   expected to behave correctly under failure, concurrency, and adversarial input.
4. **API-first.** Every capability is exposed through a versioned HTTP API before any client
   consumes it. This keeps the web application, the mobile application, and future integrations
   on equal footing.

## System shape

Zion8 is a **modular monolith**. Modules are separated by bounded context with explicit
interfaces, but deployed as one process. This is a deliberate decision:

- A single deployable keeps operational complexity, transaction boundaries, and debugging costs
  low during the phases where the domain model is still being discovered.
- Module boundaries are enforced structurally (directory layout, dependency direction), so a
  module can be extracted into a service without rewriting its interior.

Extraction candidates, in order: `ai-memory`, `notifications`, `search-indexer`. These are the
modules with genuinely different scaling and availability profiles.

```
                    +-------------------------------+
   Web (Next.js)    |                               |
   Mobile (Flutter) |        API Gateway            |
   Integrations     |      /api/v1 (NestJS)         |
                    +---------------+---------------+
                                    |
        +---------------------------+---------------------------+
        |                           |                           |
   Auth / Tenancy            Domain Modules              Platform Modules
   (implemented)          (membership, giving,        (events, search,
                            events, memory)             notifications)
        |                           |                           |
        +---------------------------+---------------------------+
                                    |
                    +---------------+---------------+
                    |                               |
              PostgreSQL                        Redis
         (SoR + RLS + pgvector)          (sessions, cache, locks)
                    |
          [Transactional outbox] -> NATS JetStream -> consumers
                    |
          OpenSearch (search) + Object storage (archives)
```

## Bounded contexts

| Context | Responsibility | Status |
| --- | --- | --- |
| `auth` | Identity, credentials, sessions, refresh rotation, RBAC | Implemented |
| `tenancy` | Tenant lifecycle, memberships, tenant context resolution | Implemented |
| `membership` | People, households, pastoral records | Planned |
| `attendance` | Services, check-in, attendance history | Planned |
| `events` | Calendar, registration, facilities | Planned |
| `giving` | Contributions, funds, statements | Planned |
| `accounting` | Ledgers, budgets, reconciliation | Planned |
| `care` | Prayer requests, counseling, follow-up | Planned |
| `memory` | Sermons, documents, archives, timeline | Planned |
| `ai` | Embeddings, semantic search, grounded answers | Planned |

## Layers inside a module

Each module follows Clean Architecture. Dependencies point inward only.

| Layer | Contents | May depend on |
| --- | --- | --- |
| Domain | Entities, value objects, invariants, domain errors | Nothing |
| Application | Use cases, ports (interfaces), orchestration | Domain |
| Infrastructure | Prisma repositories, Redis adapters, external clients | Application, Domain |
| Interface | Controllers, DTOs, guards, presenters | Application, Domain |

Transport and persistence concerns never leak into domain logic, which is what makes the
eventual extraction mechanical rather than archaeological.

## Data ownership

| Store | Role | Rationale |
| --- | --- | --- |
| PostgreSQL | System of record | Transactions, constraints, RLS, `pgvector` co-location |
| Redis | Sessions, cache, distributed locks | Ephemeral, high-throughput, non-authoritative |
| OpenSearch | Full-text and faceted search | Purpose-built relevance and scale |
| `pgvector` | Embeddings for semantic discovery | Keeps vectors transactionally consistent with source rows |
| Object storage | Sermon media, documents, exports | Large immutable blobs do not belong in the database |

Nothing in Redis or OpenSearch is authoritative. Both can be rebuilt from PostgreSQL.

## Events

Domain events are written to a **transactional outbox** in the same transaction as the state
change. A relay publishes them to NATS JetStream. This gives at-least-once delivery without
distributed transactions, and guarantees that an event is never emitted for a rolled-back write.

Consumers must be idempotent, keyed by event id. The outbox also doubles as an audit trail,
which directly serves the "preserve church history" goal.

## Security model

- **Credentials**: Argon2id with per-deployment cost parameters.
- **Access tokens**: short-lived JWTs carrying user, tenant, and role claims.
- **Refresh tokens**: opaque, hashed at rest, rotated on every use, with reuse detection that
  revokes the token family on suspected theft.
- **Authorization**: role-based permissions resolved per tenant, enforced by guards at the
  interface layer and by RLS at the data layer.
- **Defense in depth**: even a bug in a guard cannot cross tenant boundaries, because the
  database refuses the query.

See `docs/architecture/MULTI_TENANCY.md` for the isolation mechanism in detail.

## Observability

Structured JSON logs via Pino, correlated by a request id propagated through
`AsyncLocalStorage`. Every log line carries the request id, and where applicable the tenant and
user ids, so a request can be traced across middleware, guards, use cases, and persistence
without ad-hoc instrumentation.

## API conventions

- Versioning is expressed in the URI: `/api/v1/...`. The version is configuration, not code.
- Errors follow a single envelope with a stable machine-readable `code`, a human-readable
  `message`, and optional field-level `details`.
- All request and response shapes are defined once in `packages/contracts` and validated by both
  the server and every client. A contract change is a compile error, not a runtime surprise.
