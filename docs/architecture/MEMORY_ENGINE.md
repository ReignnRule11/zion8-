# Digital Memory Engine

The Digital Memory Engine is Zion8's institutional archive: the place a church
keeps what it remembers. A 1952 photograph, a scanned minute book, a sermon
recording, a Sunday bulletin, a baptismal certificate — all of it is one kind of
thing (an **artifact**) differentiated by an attribute, not by a bespoke table per
medium.

It lives in one bounded context, `apps/api/src/modules/memory`, exposed over REST
at `/api/v1/memory`. This document covers **Phase A**, which owns the archive
itself: ingest, immutable versions, links, tags, durable processing jobs, and the
event trail. Extraction, retrieval, the entity graph, and grounded answers are
later phases inside the same module.

## Why one aggregate, not many

Most systems that hold photographs, audio, and documents end up with three
pipelines and three search surfaces. The engine instead treats modality as a
`kind` on a single aggregate, so that:

- one ingest path validates, stores, and addresses every artifact;
- one processing pipeline dispatches by `kind` when it must;
- one retrieval surface (a later phase) serves the whole archive.

The trade-off is a wider row. That is cheaper than three code paths that must be
kept in agreement forever.

## Aggregate model

| Model | Table | Role |
|-------|-------|------|
| Artifact | `memory_artifacts` | The record: title, kind, dates, status, origin. Metadata a person edits lives here. |
| Version | `memory_artifact_versions` | Immutable bytes. Content-addressed by `sha256`. Exactly one `isCurrent` per artifact. |
| Link | `memory_artifact_links` | Attaches an artifact to a member, family, department, event, and so on. |
| Tag | `memory_artifact_tags` | Free-text labels for curation. |
| Job | `memory_processing_jobs` | Durable unit of pipeline work, claimed with `SKIP LOCKED`. |
| Outbox event | `outbox_events` | Integration events written in the same transaction as the state change. |

### Versions are immutable and content-addressed

Bytes are hashed with SHA-256 and stored under
`tenants/<tenantId>/memory/<sha[0:2]>/<sha256>`. Storing the same bytes twice
writes nothing the second time. A **version** row points at that object; the
artifact points at its current version.

Because the key is derived from the content, an artifact can never be silently
overwritten. If a re-scan of a minute book differs, it becomes version 2 and
version 1 remains downloadable. History is not a feature bolted on later; it is a
consequence of the key.

Two useful properties fall out of this:

- **Deduplication.** Ingest looks for an existing current version with the same
  `sha256` and records `duplicateOfArtifactId` so the UI can say "these bytes are
  already archived" without storing a second copy.
- **Immutable citations.** A later phase can cite `(artifactId, versionId,
  sha256)` and that citation stays true even after the artifact is re-uploaded.

### Memory is a superset of member documents

Membership documents already exist and are not moved. The engine is designed to
*link* them, not absorb them: `origin` distinguishes `UPLOAD`,
`MEMBERSHIP_DOCUMENT`, `MEMBER_IMPORT`, and `EXTERNAL`, and `sourceResourceType` /
`sourceResourceId` record where a non-uploaded artifact came from. A church can
adopt the archive without a migration that rewrites pastoral records.

## Ingest: validate first, then transact

`POST /memory/artifacts` (permission `memory:ingest`) runs in a fixed order so a
bad request is rejected before anything is written:

1. **Declared type allow-list.** `contentType` must be in
   `ALLOWED_ARTIFACT_TYPES`; otherwise `415 MEMORY_ARTIFACT_TYPE_UNSUPPORTED`.
2. **Decode and bound.** Base64 is decoded; empty is a `415`, and more than
   `MAX_ARTIFACT_BYTES` (4 MiB decoded) is `413 MEMORY_ARTIFACT_TOO_LARGE`.
   Larger media is expected to arrive later through direct object-storage upload.
3. **Sniff the bytes.** `detectContentType` reads magic numbers, so the declared
   type is only a hint. A PDF renamed `.jpg` is stored as a PDF, and a file whose
   bytes are genuinely unsupported is rejected.
4. **Store the object.** The blob is written to object storage under its
   content-addressed key. No database transaction is held open across the write.
5. **Commit one transaction.** The artifact row, its first version, its tags, its
   links, an outbox event (`memory.artifact.created`), and a `METADATA`
   processing job are all written together. Either the archive records the
   artifact and promises to process it, or neither happened.

The canonical `detectedContentType` is deliberately left `null` at ingest. It is
written by the `METADATA` job from the bytes as they were stored, which is the
only value the rest of the system trusts.

## Processing pipeline

Work is modelled as durable rows, not as fire-and-forget calls. The runner claims
a batch with:

```sql
UPDATE memory_processing_jobs SET status = 'RUNNING', ...
WHERE id IN (
  SELECT id FROM memory_processing_jobs
  WHERE status = 'PENDING' AND available_at <= now()
  ORDER BY priority, created_at
  FOR UPDATE SKIP LOCKED
  LIMIT :batch
)
```

`SKIP LOCKED` means several API instances can run workers without ever taking the
same job twice, and a crash leaves the job `RUNNING` to be reclaimed rather than
lost.

Stages: `METADATA`, `EXTRACT`, `TRANSCRIBE`, `CATEGORIZE`, `CHUNK`, `EMBED`,
`INDEX`, `GRAPH`, `TIMELINE`.

**Phase A implements `METADATA`.** It loads the stored bytes, re-detects the
content type, writes it, and marks the artifact `READY`. A `METADATA` job that
exhausts its retries marks the artifact `FAILED`.

### A missing capability is blocked, never silent

The single most important rule in the pipeline: a stage that cannot run because a
capability is not configured does **not** report success.

- `EXTRACT` with no OCR endpoint → job `BLOCKED` with reason
  `OCR_NOT_CONFIGURED`, and the artifact becomes `PARTIAL`.
- `TRANSCRIBE` with no speech-to-text endpoint → job `BLOCKED` with reason
  `TRANSCRIPTION_NOT_CONFIGURED`, artifact `PARTIAL`.
- A stage that is defined but not yet implemented → `BLOCKED` with
  `STAGE_NOT_AVAILABLE_YET`.

This is what lets the archive claim "the engine has read this document" and mean
it. A deployment with zero external services still archives, still serves
downloads, and still tells the truth about what it has been able to extract.

Failures are different from blocks: a transient error retries with exponential
backoff (5s doubling to a 300s ceiling) up to `max_attempts`, then the job is
`FAILED` with `lastError`.

### Reprocessing

`POST /memory/artifacts/:artifactId/reprocess` (permission `memory:curate`)
requeues stages for the current version. It is idempotent via a
`dedupeKey = "<stage>:<versionId>"`:

- absent → create a `PENDING` job;
- `PENDING` / `RUNNING` → return it unchanged;
- `BLOCKED` / `FAILED` → reset to `PENDING` and clear the reason.

When no stages are named, the default depends on the kind: recordings get
`TRANSCRIBE`, everything else gets `EXTRACT`. So an operator who configures OCR
later can reprocess the whole scanned backlog without remembering which stage
each item needed.

## Events

Ingest and archive each write an outbox row in the same transaction as the state
change:

| Event | When |
|-------|------|
| `memory.artifact.created` | An artifact is first stored. |
| `memory.artifact.archived` | An artifact is archived. |

The payload carries the artifact id, its `kind` and `status`, the current version
id, and whether it was a duplicate; headers carry `x-zion8-event-version: 1`.

The relay is a **poller** rather than an in-transaction publish. Publishing inside
the domain transaction would put a network call inside a database transaction and
could still lose the event; polling the committed outbox is a few milliseconds
slower and correct by construction. `claimBatch` uses `SKIP LOCKED`, and
`markFailed` applies backoff, so at-least-once delivery holds without distributed
transactions. In development and CI the publisher is the log; set
`EVENT_WEBHOOK_URL` to also POST each event to an HTTP endpoint. Production points
the same `EVENT_PUBLISHER` port at NATS JetStream.

## Storage

Binary content sits behind the `OBJECT_STORAGE` port
(`apps/api/src/infrastructure/storage/object-storage.port.ts`): `put`, `get`,
`exists`. Development uses `LocalObjectStorage` under `STORAGE_DIR`; production
swaps in an S3/GCS-compatible adapter with no change to domain code. The local
adapter rejects any key that would resolve outside its root, so a mistyped key
cannot become a path traversal.

Membership's document storage was migrated onto this same port, so there is one
storage boundary in the codebase rather than two.

## REST surface

```
POST   /memory/artifacts                     ingest (base64 body)
GET    /memory/artifacts                     list; filter by search, kind, status,
                                             tag, linkType + linkId, date range,
                                             includeArchived
GET    /memory/artifacts/:artifactId         full record with links and versions
PATCH  /memory/artifacts/:artifactId         curate metadata
DELETE /memory/artifacts/:artifactId         archive, never delete
POST   /memory/artifacts/:artifactId/links   attach to a member/entity
DELETE /memory/artifacts/:artifactId/links/:linkId
POST   /memory/artifacts/:artifactId/reprocess
GET    /memory/artifacts/:artifactId/jobs
GET    /memory/artifacts/:artifactId/download   short-lived URL (300s)
GET    /memory/artifacts/:artifactId/content    streams the bytes
```

Binary content is carried on **REST only**. The GraphQL surface (added with the
retrieval phase) will expose metadata and download handles, never a binary field:
downloading through a resolver is where GraphQL integrations usually go wrong.

## Permissions

| Permission | Guards |
|------------|--------|
| `memory:read` | Browse the archive, read artifacts, versions, links, jobs, download. |
| `memory:ingest` | Add artifacts. |
| `memory:answer` | Ask grounded questions (retrieval phase). |
| `memory:curate` | Edit metadata, link/unlink, reprocess, archive. |
| `memory:admin` | Configure providers and reindex (later phases). |

Owners, senior pastors, administrators, and ministry leaders can ingest; members
and volunteers can read and (later) ask. Because a missing capability is visible
as a `BLOCKED` job, `memory:read` is enough to see why an artifact is only
`PARTIAL`.

## Multi-tenancy

Every memory table carries `tenant_id` with `FORCE ROW LEVEL SECURITY`. Reads and
writes go through `PrismaService.withTenant`, which sets the transaction-local
`app.current_tenant`; the application role is `NOBYPASSRLS`, so a query written
without a tenant scope returns nothing rather than another church's archive. The
RLS policies also admit a platform-admin scope via `app.is_platform_admin` for
operational tooling.

The worker runs outside a request, so it reads the `tenant_id` from the claimed
job row and scopes every follow-up write to it.

## Web client

Routes under `apps/web/src/app/(dashboard)/memory`:

- `/memory` — the browse grid. One grid for every modality, with filters for
  kind, status, tag, and archived, plus duplicate and date-precision cues.
- `/memory/new` — ingest. The file is encoded to base64 in the browser (in
  chunks, so a 4 MiB file does not stall the main thread) and posted through a
  server action, which re-validates with the shared Zod contract before calling
  the API.
- `/memory/[artifactId]` — the record. Current version and checksum, a download
  link, curatable metadata, links, the job list with blocked reasons, version
  history, and archive.

Client components (`apps/web/src/components/memory`) hold only ephemeral UI
state; every write is a server action. Downloads go through
`/api/memory/artifacts/[artifactId]/content`, a Next.js route handler that
exchanges the httpOnly session cookie for a bearer token and streams the API
response, so the token never reaches client JavaScript. The same route accepts
`?versionId=` to fetch a non-current version.

Because a 4 MiB artifact becomes roughly 5.6 MiB of base64 in a server-action
body, `next.config.ts` raises `experimental.serverActions.bodySizeLimit` to 6 MiB.
The API still enforces the decoded 4 MiB limit.

## Configuration

| Variable | Purpose |
|----------|---------|
| `STORAGE_DIR` | Root for the local object-storage adapter. |
| `OUTBOX_RELAY_ENABLED` / `OUTBOX_POLL_INTERVAL_MS` / `OUTBOX_BATCH_SIZE` | Outbox relay cadence. |
| `EVENT_WEBHOOK_URL` | Optional HTTP sink for published events. |
| `MEMORY_WORKER_ENABLED` / `MEMORY_WORKER_INTERVAL_MS` / `MEMORY_WORKER_BATCH_SIZE` | Processing worker cadence. |
| `MEMORY_OCR_ENDPOINT` | OCR service; blank records `EXTRACT` as blocked. |
| `MEMORY_STT_ENDPOINT` | Speech-to-text service; blank records `TRANSCRIBE` as blocked. |

Both pollers are disabled under `NODE_ENV=test` and stop on shutdown; tests drive
`drain()` / `runOnce()` directly so they never race a timer.

## Tests

- `apps/api/test/memory.e2e.test.ts` — ingest, versioning and dedupe, magic-byte
  detection, oversize and unsupported rejection, links, tags, listing and
  filters, job recording and blocked reasons, and download, against real
  PostgreSQL and object storage.
- `apps/api/src/modules/memory/memory.utils.test.ts` — content detection,
  checksums, storage keys, and the response mappers.

## Later phases

Phase A makes the archive true. The phases that follow stay inside the same
module and the same boundaries:

- **Extraction and retrieval** — text/OCR extraction, chunking, embeddings, and
  a retrieval surface whose answers must cite the versions they came from or
  decline to answer.
- **Entity graph** — linking artifacts to the scripture, people, and events they
  mention, kept separate from `member_relationships`.
- **Timeline** — projecting dated artifacts into the church's history.
- **AI answers** — grounded question answering over the archive, gated by
  `memory:answer`.

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md) — the module and layering rules this domain follows.
- [MULTI_TENANCY.md](./MULTI_TENANCY.md) — row-level security and `withTenant`.
- [SERMON.md](./SERMON.md) — publishing; sermons point at artifacts, they do not store bytes.
- [ZION_AI.md](./ZION_AI.md) — the retrieval and reasoning layer built over this archive.
- [MEMBERSHIP.md](./MEMBERSHIP.md) — the member documents this archive links to.
- [AUTHENTICATION.md](./AUTHENTICATION.md) — principals and permissions.
- [REPOSITORY_STRUCTURE.md](./REPOSITORY_STRUCTURE.md) — where every file lives.
