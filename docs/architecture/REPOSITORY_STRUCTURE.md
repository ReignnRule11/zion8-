# Zion8 Repository Structure

This document defines how the Zion8 repository is organized and how hundreds of developers work
in it without stepping on each other. It is normative: where a rule here conflicts with local
habit, this document wins.

## Architectural decisions driving the layout

| Decision | Rationale | Consequence |
| --- | --- | --- |
| Single monorepo, many deployables | Atomic cross-cutting change (contract + API + web + mobile in one PR), one dependency graph, one CI model | Requires affected-only builds, remote caching, and hard ownership boundaries to stay fast |
| Two-tier rule: `apps/` vs `packages/` | The only structural rule a newcomer must learn: an app is deployable, a package is imported | Prevents the "app imports app" sprawl that kills large monorepos |
| pnpm workspaces + Turborepo | Strict `node_modules` prevents phantom dependencies; Turbo provides the task graph and caching | Remote cache and `turbo boundaries` are required, not optional |
| Polyglot, contracts as the only cross-language seam | TypeScript for product and platform, Python for ML, Dart for mobile; sharing source across languages is not viable | Zod is the source of truth; OpenAPI is generated and used to generate Dart, Python, and TS clients |
| Trunk-based development | Long-lived branches are incompatible with hundreds of concurrent contributors | Short-lived branches, merge queue, feature flags, release branches only for mobile |
| GitOps for Kubernetes | Deploy state is reviewable in the repo | Manifests live in `infrastructure/kubernetes`; Argo CD reconciles from `main` |
| Design tokens as a single generated source | Web and mobile must not drift | One token source, generated outputs per platform |

## 1. Folder hierarchy

```
zion8/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                     # PR gate: affected-only
│   │   ├── _build.yml                 # reusable: install + turbo build
│   │   ├── _test.yml                  # reusable: unit + integration
│   │   ├── _e2e.yml                   # reusable: e2e with service containers
│   │   ├── _security.yml              # reusable: CodeQL, Trivy, dependency review
│   │   ├── _docker.yml                # reusable: build, sign, push images
│   │   ├── deploy-staging.yml         # on merge to main
│   │   ├── deploy-production.yml      # on release tag
│   │   ├── mobile-release.yml         # Flutter build and store submission
│   │   ├── release.yml                # Changesets version and publish
│   │   └── codegen-drift.yml          # fails if generated clients are stale
│   ├── actions/                       # composite actions: setup-node-pnpm, setup-flutter, setup-python
│   ├── CODEOWNERS                     # per-directory ownership
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── ISSUE_TEMPLATE/
│   └── dependabot.yml
│
├── apps/                              # Deployable units only
│   ├── web/                           # Next.js church and tenant application
│   │   ├── src/app/                   # App Router routes and route groups
│   │   ├── src/features/              # feature-sliced UI and hooks
│   │   ├── src/lib/                   # client, session, env
│   │   ├── public/
│   │   ├── e2e/                       # Playwright
│   │   └── next.config.ts
│   ├── admin/                         # platform admin console (Next.js)
│   ├── mobile/                        # Flutter application and melos workspace
│   │   ├── lib/features/
│   │   ├── lib/core/
│   │   ├── integration_test/
│   │   ├── assets/
│   │   └── pubspec.yaml
│   ├── api/                           # NestJS modular monolith (HTTP source of truth)
│   │   ├── src/modules/               # auth, tenancy, onboarding, membership, attendance, events, giving, care, memory, ai
│   │   ├── src/common/
│   │   ├── src/infrastructure/        # prisma, redis, opensearch, storage, nats
│   │   ├── prisma/                    # schema.prisma, migrations, seed.ts
│   │   └── test/
│   ├── workers/                       # NATS consumers, outbox relay, schedulers
│   ├── ai-api/                        # Python FastAPI: embeddings, RAG, OCR, speech
│   │   ├── app/api/
│   │   ├── app/domain/
│   │   ├── app/ml/                    # embeddings, rerank, ocr, speech
│   │   ├── app/rag/
│   │   └── pyproject.toml
│   └── docs-site/                     # published developer and product documentation
│
├── packages/                          # Shared libraries only (never deployed directly)
│   ├── contracts/                     # Zod schemas: the canonical API contract
│   ├── sdk/                           # generated typed clients (TS) plus hand-written wrappers
│   ├── design-tokens/                 # token source plus generated CSS, TS, and Dart
│   ├── ui/                            # React design system primitives
│   ├── auth/                          # shared auth primitives: claims, permissions
│   ├── database/                      # Prisma client wrapper and RLS scope helpers
│   ├── events/                        # event envelope types and outbox contract
│   ├── observability/                 # logger, metrics, tracing, request context
│   ├── feature-flags/                 # typed flag evaluation
│   ├── ai-client/                     # typed client for apps/ai-api
│   ├── testing/                       # fixtures, factories, test containers
│   ├── utils/                         # framework-free helpers
│   ├── config/                        # runtime config loading and validation
│   ├── eslint-config/                 # shared flat config and boundary rules
│   └── tsconfig/                      # shared TS presets: base, library, nestjs, nextjs
│
├── infrastructure/
│   ├── docker/
│   │   ├── base/                      # shared multi-stage bases
│   │   ├── api.Dockerfile
│   │   ├── web.Dockerfile
│   │   ├── workers.Dockerfile
│   │   ├── ai-api.Dockerfile
│   │   ├── docker-bake.hcl            # multi-arch build targets
│   │   └── compose/                   # local stack definitions
│   ├── kubernetes/
│   │   ├── base/                      # kustomize base manifests
│   │   ├── overlays/                  # dev, staging, production
│   │   ├── charts/                    # Helm charts per service
│   │   ├── cluster/                   # ingress, cert-manager, autoscaler, mesh
│   │   ├── policies/                  # Kyverno or OPA guardrails
│   │   └── gitops/                    # Argo CD Applications and AppProjects
│   ├── terraform/
│   │   ├── modules/                   # network, database, cache, search, storage, cluster, iam
│   │   └── environments/              # dev, staging, production
│   ├── postgres/
│   │   ├── init/                      # roles and extensions for local and dev
│   │   └── policies/                  # RLS policy definitions under review
│   └── observability/
│       ├── prometheus/                # rules and SLOs
│       ├── grafana/                   # dashboards as code
│       ├── loki/                      # log collectors
│       └── otel/                      # trace collectors
│
├── tools/
│   ├── codegen/                       # Zod -> OpenAPI -> TS, Dart, Python clients
│   ├── generators/                    # scaffolds for modules and packages
│   ├── evals/                         # AI prompt and model regression suites
│   └── scripts/                       # repo maintenance, seeds, migration helpers
│
├── docs/
│   ├── adr/                           # Architecture Decision Records, numbered
│   ├── architecture/                  # this document, ARCHITECTURE.md, MULTI_TENANCY.md, MEMBERSHIP.md
│   ├── standards/                     # coding, testing, review, security standards
│   ├── runbooks/                      # incident and operational procedures
│   └── onboarding/                    # day-1 developer guide
│
├── .changeset/                        # release intents for apps and packages
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── README.md
```

### Structural rules (enforced, not advisory)

1. `apps/*` must never be imported by any other workspace. Enforced by `turbo boundaries` and
   `dependency-cruiser`.
2. `packages/*` must never import from `apps/*`.
3. Packages may only depend on packages in a lower or equal layer (see section 7).
4. Every workspace has exactly one owner team in `CODEOWNERS`.
5. Generated code lives only in `packages/sdk/**/generated` and
   `packages/design-tokens/generated`, and is never edited by hand.

## 2. Development workflow

### Onboarding (day 1)

```bash
# Install the pinned toolchain: Node 22, pnpm 10.34.5, Python, Flutter, kubectl
mise install

# Install workspace dependencies
pnpm install

# Create local environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Start Postgres with pgvector, Redis, and OpenSearch
docker compose up -d

# Apply the schema and seed synthetic data
pnpm --filter @zion8/api prisma:migrate
pnpm --filter @zion8/api prisma:seed

# Run every app in watch mode
pnpm dev
```

A devcontainer in `.devcontainer/` mirrors this so a new hire is productive without host setup.

### Inner loop

| Task | Command |
| --- | --- |
| Run everything | `pnpm dev` |
| Run one app | `pnpm --filter @zion8/web dev` |
| Affected since main | `pnpm turbo run build --filter=...[origin/main]` |
| Typecheck, lint, test | `pnpm turbo run typecheck lint test` |
| Regenerate contracts and clients | `pnpm codegen` |

Remote caching is mandatory at scale: CI and every developer share artifacts, so a change to
`apps/web` never rebuilds `apps/api`.

### Change flow

1. Branch from `main` using the naming convention in section 3.
2. Make a small change. `pnpm turbo` runs only what is affected.
3. Open a PR. CI runs affected build, typecheck, lint, and unit and e2e tests for touched areas,
   plus security scans.
4. Reviewers come from `CODEOWNERS` for each touched directory. Review SLA is one business day.
5. Merge via the **merge queue**. The queue rebases and re-runs the gate, so `main` is never
   broken by a PR that was green when it was opened.
6. On merge, `deploy-staging.yml` ships automatically.
7. Promotion to production is a signed semantic version tag cut by Changesets.

### Definition of Done

Code merged; tests at the required layer; the contract updated in `packages/contracts` when the
API changes; an ADR when a decision is hard to reverse; and an observability path (log, metric,
or trace) for any new runtime behavior.

### Codegen discipline

`packages/contracts` is edited by hand. Everything else is derived. `codegen-drift.yml`
regenerates clients and fails the PR if the output differs from what is committed, so the Dart
and Python clients can never silently lag the API.

## 3. Branch strategy

Trunk-based development. `main` is always releasable.

| Branch | Purpose | Lifetime | Protection |
| --- | --- | --- | --- |
| `main` | Trunk, deployable to staging | permanent | protected, merge queue, required checks, required review |
| `YYMMDD-<type>-<slug>` | Feature and fix work | under 2 days | normal PR rules |
| `release/<major>.<minor>.x` | Patch train, primarily mobile where store review forces a freeze | days to weeks | protected |
| `hotfix/<ticket>` | Production incident fix, branched from the release tag | hours | expedited review, deploys to production |

Rules that make this work with hundreds of developers:

- Branches live under two days. Anything larger is hidden behind a feature flag on `main`, not
  behind a long-lived branch.
- There is no shared `develop` branch. Environment progression happens by merge and tag, not by
  branch.
- Tags are the release artifact: `v1.4.0`, `web-v1.4.0`, `mobile-v1.4.0`. Production deploys only
  from tags.
- The mobile app gets a release branch because app store review is a genuine freeze. Web and API
  do not.
- Every commit on `main` uses Conventional Commits, which drives Changesets automatically.

## 4. Coding standards

### Cross-cutting

- Conventional Commits, enforced by commitlint. The scope is the workspace name, for example
  `feat(api/auth): ...`.
- PRs target under 400 changed lines. Larger PRs require a stated justification.
- Prettier for TypeScript, JSON, and Markdown. `ruff format` for Python. `dart format` for Dart.
- Comments explain why, not what.

### TypeScript

- `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noImplicitOverride`.
- No `any`. External boundaries are parsed with Zod, never cast.
- Explicit return types on exported functions.
- `import type` for type-only imports.
- Application code throws typed domain errors, never bare `Error`.

### NestJS (`apps/api`)

- One bounded context per module under `src/modules/<context>`.
- Layers inside a module: domain, application, infrastructure, interface. Dependencies point
  inward only.
- Controllers do transport only: validate, delegate to a use case, map the result. No business
  logic.
- All tenant-scoped persistence goes through the scoped Prisma helpers so the RLS context is
  always set.
- Everything a controller returns is a contract type from `packages/contracts`.

### React (`apps/web`, `apps/admin`)

- Server Components by default. `'use client'` only where interactivity requires it.
- Feature-sliced structure: `src/features/<feature>/{components,hooks,api}`.
- No raw `fetch`; use the typed `@zion8/sdk` client.
- All UI primitives come from `@zion8/ui`. A page never re-implements a button.

### Flutter (`apps/mobile`)

- `flutter_lints` plus repo-specific rules; `melos` for the Dart workspace.
- Feature-first folders, with `core/` for cross-cutting concerns.
- Generated API client from OpenAPI only; no hand-written HTTP DTOs.
- Design values come from generated tokens, never hardcoded color or spacing literals.

### Python (`apps/ai-api`)

- `ruff` for lint and format; `mypy` in strict mode on the public surface.
- `pyproject.toml` with locked dependency groups; no requirements files.
- Pure functions in `app/domain`; framework code only in `app/api`.

### Architecture enforcement

`packages/eslint-config` ships boundary rules and a `dependency-cruiser` configuration. A PR that
violates the layer rules or the app/package rules fails CI rather than review.

### Testing standards

| Layer | Tool | Requirement |
| --- | --- | --- |
| Unit | Vitest, pytest, flutter test | Mandatory for domain and application logic |
| Integration | Vitest with real Postgres and Redis | Mandatory for persistence, RLS, and event paths |
| Contract | Schema and generated client tests | Mandatory for any API change |
| End-to-end | Playwright, supertest, integration_test | Mandatory for critical user journeys |
| AI evals | `tools/evals` | Mandatory for prompt or model changes |

Coverage gate: 80% on `packages/` and on the `apps/api` domain and application layers.

## 5. Environment configuration

Twelve-factor. Configuration is environment data, validated at boot, and never committed.

### Environment matrix

| Environment | Provisioned by | Data | Trigger |
| --- | --- | --- | --- |
| local | docker compose | synthetic seed | `pnpm dev` |
| preview | ephemeral namespace per PR | synthetic seed | PR label |
| dev | Terraform and Argo CD | synthetic or sanitized | merge to `main`, optional |
| staging | Terraform and Argo CD | production-like anonymized | merge to `main` |
| production | Terraform and Argo CD | live | release tag |

### Mechanism

1. Each app ships an `.env.example` documenting every variable. Real files are git-ignored.
2. `packages/config` validates all environment variables with Zod at process start. A missing or
   malformed variable is a boot failure, never a runtime surprise.
3. Config precedence: Kubernetes ConfigMap, then Secret, then defaults. The same variable names in
   every environment.
4. Secrets are never in the repo. They live in a cloud secret manager and reach pods through the
   External Secrets Operator. Rotation is centralized; pods pick up changes on restart.
5. Per-environment non-secret configuration lives as code in
   `infrastructure/kubernetes/overlays/<env>` and is reviewed like any other change.
6. Behavior that varies per tenant or per rollout is a feature flag in
   `packages/feature-flags`, not an environment variable.
7. Terraform owns infrastructure state and the secret manager, so no engineer hand-creates a
   resource.

### Parity rule

If a bug cannot be reproduced on staging, the difference is a configuration defect. Staging runs
the same images, the same migrations, and the same topology as production, differing only in
scale and data.

## 6. Dependency management

### Single version policy via pnpm catalogs

With hundreds of developers, version skew in React, NestJS, or Zod is the largest single source
of accidental breakage. `pnpm-workspace.yaml` declares every shared dependency once, and
workspaces reference the catalog:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tools/*'

catalog:
  react: 19.0.0
  next: 15.5.25
  '@nestjs/core': ^11.0.0
  zod: ^3.24.1
  typescript: ^5.7.2
  vitest: ^2.1.8
```

A workspace declares `"zod": "catalog:"`. Upgrading Zod becomes one PR that touches one file, and
the affected graph tells you exactly what to verify.

### Internal packages

- Referenced as `workspace:*`. Never published to a public registry.
- Versioned with Changesets when they must be consumed by external or mobile toolchains.
- Removed from the graph as soon as the last consumer disappears; `turbo boundaries` reports
  orphans.

### External dependencies

- All installs are deliberate. New runtime dependencies require a one-line justification in the
  PR.
- No phantom dependencies: pnpm's isolated `node_modules` means anything imported must be
  declared.
- Native and postinstall build scripts are allowlisted in `pnpm.onlyBuiltDependencies`. Anything
  not listed cannot run scripts, which blocks an entire class of supply-chain attack.
- Renovate runs on a schedule with grouping: patch updates auto-merge after CI, minor updates are
  batched weekly, major updates are individual PRs with a named owner.
- The lockfile is committed, and CI installs with `--frozen-lockfile` only.
- Container base images are pinned by digest and rebuilt on a schedule.
- Every release produces an SBOM and signed provenance. Dependency review and license checks run
  on every PR.

### Deprecation and removal

Owners are recorded per package. An unmaintained dependency, an unused export, or an orphaned
package is removed rather than tolerated. Stale code is a security surface.

## 7. Shared libraries

### Package catalog

| Package | Purpose | Consumers | Layer | Stability |
| --- | --- | --- | --- | --- |
| `@zion8/contracts` | Canonical Zod schemas and the API contract | everything | 0 | stable, additive changes only |
| `@zion8/design-tokens` | Token source, generates CSS, TS, and Dart | web, admin, mobile | 0 | stable |
| `@zion8/tsconfig` | TypeScript presets | all TypeScript | dev-only | stable |
| `@zion8/eslint-config` | Lint and boundary rules | all TypeScript | dev-only | stable |
| `@zion8/utils` | Framework-free helpers | all | 1 | stable |
| `@zion8/observability` | Logger, metrics, tracing, request context | api, workers, ai-api, web | 1 | stable |
| `@zion8/config` | Typed environment loading and validation | all runtimes | 1 | stable |
| `@zion8/feature-flags` | Typed flag evaluation | web, mobile, api | 1 | evolving |
| `@zion8/testing` | Fixtures, factories, test containers | all | dev-only | stable |
| `@zion8/auth` | Claims, permissions, role mapping | api, web, admin, mobile | 2 | evolving |
| `@zion8/database` | Prisma client and RLS scope helpers | api, workers | 2 | evolving |
| `@zion8/events` | Event envelope and outbox contract | api, workers | 2 | evolving |
| `@zion8/ai-client` | Typed client for `apps/ai-api` | api, workers, web | 2 | evolving |
| `@zion8/sdk` | Generated typed HTTP clients | web, admin, mobile, integrations | 3 | generated |
| `@zion8/ui` | React design-system primitives | web, admin | 4 | evolving |

### Dependency direction

Layers depend downward only: 4 to 3 to 2 to 1 to 0. Nothing depends upward.

```
layer 0-1   contracts, design-tokens, config, tsconfig, eslint-config,
            utils, observability, feature-flags
layer 2     auth, database, events, ai-client
layer 3     sdk
layer 4     ui
```

`@zion8/ui` and `@zion8/sdk` depend on `contracts` and `design-tokens`, but nothing depends on
them except apps. That keeps app-level concerns from leaking into the foundation.

### Non-TypeScript shared assets

- `packages/contracts` produces `openapi.json`, consumed by the Dart and Python generators.
- `packages/design-tokens` produces Dart constants for Flutter and CSS custom properties plus
  TypeScript for React, all from one source.
- `packages/testing` is the only place allowed to hold cross-cutting fixtures, so test data is
  not duplicated per app.

## Scaling to hundreds of developers

The structure above is only half the answer. These practices keep it from degrading:

- **Ownership.** Every directory has a team in `CODEOWNERS`. Ownership is public, so a PR finds a
  reviewer without a human router.
- **Team topologies.** A platform team owns `packages/*`, `infrastructure/*`, and CI.
  Stream-aligned teams own bounded contexts in `apps/api/src/modules/*` and their surfaces. The
  platform team's product is developer velocity.
- **Affected everything.** No CI job builds the world. Remote cache plus
  `--filter=...[origin/main]` keeps this tractable at any repository size.
- **Merge queue.** The only reliable way to keep `main` green with hundreds of concurrent merges.
- **ADR habit.** Every hard-to-reverse decision becomes a numbered record in `docs/adr`. This is
  how a large team avoids re-litigating decisions it cannot remember making.
- **Sparse checkout and partial clone.** Mobile and AI developers clone only their subtree, so a
  large repository stays fast on a laptop.
- **Generated code is verified, not reviewed.** Drift checks replace manual review of thousands of
  generated lines.
- **Extraction is planned, not reactive.** `ai-api`, `workers`, and `memory` are already separate
  deployables, so scaling pressure is absorbed without a rewrite.
