# Sermon platform

The sermon platform is Zion8's publishing surface for teaching: series, speakers,
when a message was preached, who may hear it, and the derived study layer
(transcript, chapters, scripture, summary, tags). It is a bounded context of its
own, `apps/api/src/modules/sermon`, exposed over REST at `/api/v1/sermons` and
an unauthenticated public surface at `/api/v1/public/sermons`.

It does not store media. Bytes live in the [Digital Memory Engine](./MEMORY_ENGINE.md)
and are linked by `mediaArtifactId` with `MemoryLinkType.SERMON`. Derived fields
are produced through [Zion AI](./ZION_AI.md) ports so the same deterministic
providers that index the archive also chapterize and summarise a sermon.

## Why a separate context

Memory is an archive: ingest, versions, and honesty about what has been read.
A sermon is a *publication*: a slug, a series, a visibility, a podcast enclosure,
a share token, pastoral notes. Those invariants do not belong on an artifact row.

Keeping them apart means:

- Memory never has to know about RSS, share expiry, or `SERMON_PUBLISH`.
- Sermons never write object-storage keys or invent a second copy of the bytes.
- Zion AI indexes a sermon as `AiSourceType.SERMON` rather than a second search
  engine, so a later `/ai/search` query can cite the same transcript the study
  page shows.

## Aggregate model

| Model | Table | Role |
|-------|-------|------|
| Series | `sermon_series` | A labelled run of sermons (Advent, a book study). Optional parent. |
| Sermon | `sermons` | The publication: title, speaker, slug, status, visibility, media pointer. |
| Tag | `sermon_tags` | Curated and pipeline-suggested labels. |
| Transcript | `sermon_transcripts` + `sermon_transcript_segments` | Versioned text. Exactly one `isCurrent`. |
| Chapter | `sermon_chapters` | Jump points derived from the transcript. |
| Scripture | `sermon_scriptures` | Canonical references detected in the text. |
| Insight | `sermon_insights` | Summary, key points, social caption, provider. |
| Note | `sermon_notes` | Private study notes owned by a user. |
| Share | `sermon_shares` | Unauthenticated tokens; live until revoked or expired. |
| Job | `sermon_processing_jobs` | Durable pipeline work, claimed with `SKIP LOCKED`. |

All eleven tables use `FORCE ROW LEVEL SECURITY`. Reads and writes go through
`withTenant` / `withScope`; the public permalink and share resolver use
`withoutScope` only to look up the tenant or token, then re-enter tenant scope
for the sermon row.

## Status and visibility

`SermonStatus` is the lifecycle:

| Status | Meaning |
|--------|---------|
| `DRAFT` | Metadata only. Never public. |
| `PROCESSING` | Jobs are outstanding. Cannot be published. |
| `READY` | Jobs have settled (succeeded or blocked). Publishable. |
| `PUBLISHED` | Live for the chosen visibility. |
| `ARCHIVED` | Hidden from default lists and public surfaces. |

`SermonVisibility` is who may hear a *published* sermon:

| Visibility | Who |
|------------|-----|
| `PRIVATE` | Staff with `sermon:manage` / `sermon:publish`. |
| `MEMBERS` | Anyone with `sermon:read`. |
| `PUBLIC` | Unauthenticated permalink and the podcast feed. |

Drafts are never public, regardless of the visibility flag. A share token is the
one exception: it resolves even an unpublished sermon until it is revoked or
expired, so a pastor can preview a draft with a congregation member.

A sermon is not publishable when it is still `PROCESSING`, already `ARCHIVED`,
or a `DRAFT` with neither media nor a transcript (`SERMON_NOT_PUBLISHABLE`).

## Media

Create accepts one of:

- metadata only;
- `artifactId` of an existing Memory artifact whose content type is in
  `ALLOWED_SERMON_MEDIA_TYPES`;
- an inline upload (`fileName` + `contentType` + `contentBase64`), which the
  sermon service writes through `ArtifactService.create` as kind `SERMON`;
- `transcriptText`, with or without media.

Upload and `artifactId` are mutually exclusive. Allowed types are Memory's
audio and video types plus `text/plain`, `text/markdown`, and `application/pdf`.
The decoded size cap is `MAX_SERMON_MEDIA_BYTES` (= `MAX_ARTIFACT_BYTES`, 4 MiB).

`mediaKind` is derived from the content type (`AUDIO` / `VIDEO` / `TEXT` /
`NONE`). The sermon row stores only `mediaArtifactId`; the player and the
podcast enclosure stream bytes from Memory.

Public streaming:

- `GET /api/v1/public/sermons/:tenantSlug/:sermonSlug/media` — published + public.
- `GET /api/v1/public/sermons/shares/:token/media` — a live share token.

Both return `SERMON_MEDIA_REQUIRED` when there is no artifact.

## Processing pipeline

Work is modelled as durable rows, not fire-and-forget calls. The runner claims
a batch with `FOR UPDATE SKIP LOCKED`. Tests and operators drive it with
`SermonJobRunner.runOnce()`; the interval poller is disabled under
`NODE_ENV=test`.

Stages, in default order:

| Stage | Input | Output | If the capability is missing |
|-------|-------|--------|------------------------------|
| `TRANSCRIBE` | Audio/video/text artifact | Current transcript | `TRANSCRIPTION_NOT_CONFIGURED` or `TEXT_EXTRACTION_NOT_CONFIGURED` |
| `SCRIPTURE` | Transcript | `sermon_scriptures` | `TRANSCRIPT_REQUIRED` |
| `SPEAKER` | Transcript | `speakerName` when empty | `TRANSCRIPT_REQUIRED` |
| `SUMMARIZE` | Transcript + chat port | `sermon_insights` | `TRANSCRIPT_REQUIRED` |
| `CHAPTERIZE` | Transcript | `sermon_chapters` | `TRANSCRIPT_REQUIRED` |
| `TAG` | Transcript | extra `sermon_tags` | `TRANSCRIPT_REQUIRED` |
| `INDEX` | Transcript | `ai_documents` `sourceType=SERMON` `versionKey=current` | `TRANSCRIPT_REQUIRED` |

`TRANSCRIBE` is skipped when a transcript is already present (create-time
`transcriptText`, or a later `POST /sermons/:id/transcript`). TEXT media is
read from object storage when `isTextReadable`; PDFs without an extractor
become `TEXT_EXTRACTION_NOT_CONFIGURED`. Audio and video without
`MEMORY_STT_ENDPOINT` become `TRANSCRIPTION_NOT_CONFIGURED`. The pipeline
never invents a transcript.

A blocked or failed stage is a named reason on the job row, not a successful
empty result. When no `PENDING`/`RUNNING` jobs remain, `markReadyIfSettled`
moves `PROCESSING` → `READY` so a church can still publish a recording whose
speech-to-text is not configured.

`POST /sermons/:id/generate` runs one mapped stage immediately (`SUMMARY` and
`SOCIAL` → `SUMMARIZE`, `CHAPTERS` → `CHAPTERIZE`, `TAGS` → `TAG`) and returns
`SERMON_PIPELINE_BLOCKED` when that stage cannot run.

`POST /sermons/:id/reprocess` re-queues selected stages (or the default set)
and returns the job list.

INDEX does not embed. It upserts an `AiDocument` in `PENDING` status; the
Zion AI indexer (`findPendingSermons` / `indexSermon`, drained after artifacts
in `AiIndexRunner.runOnce`) chunks and embeds it. Rebuilding the AI index
never requires a second copy of the sermon text.

## Public surfaces

Route order on `SermonPublicController` is deliberate: `shares/:token` and
`:tenantSlug/podcast.xml` are registered before `:tenantSlug/:sermonSlug`.

| Route | Auth | Rule |
|-------|------|------|
| `GET /public/sermons/shares/:token` | None | Live token, sermon not archived. |
| `GET /public/sermons/shares/:token/media` | None | Same, plus an attached artifact. |
| `GET /public/sermons/:tenantSlug/podcast.xml` | None | At least one `PUBLISHED` + `PUBLIC` + `AUDIO`/`VIDEO` sermon. `application/rss+xml`. |
| `GET /public/sermons/:tenantSlug/:sermonSlug` | None | `PUBLISHED` + `PUBLIC`. |
| `GET /public/sermons/:tenantSlug/:sermonSlug/media` | None | Same, plus an attached artifact. |

The podcast channel links to `${appBaseUrl}/listen/${tenantSlug}`. Item
enclosures point at the public media route so a feed reader does not need a
Memory download URL. An empty or missing feed is `404 SERMON_PODCAST_UNAVAILABLE`,
not an empty RSS document.

Share URLs are `${appBaseUrl}/listen/s/${token}`. Revoke is
`DELETE /sermons/:id/shares/:shareId` and subsequent resolves return
`410 SERMON_SHARE_REVOKED` (expired tokens are `410 SERMON_SHARE_EXPIRED`).

The web app renders permalinks at `/listen/[tenantSlug]/[sermonSlug]` and
shares at `/listen/s/[token]`. Dashboard CRUD lives under `/sermons`.

## Permissions

No new Permission keys. Existing ones become real:

| Permission | Who (default) | What |
|------------|---------------|------|
| `sermon:read` | MEMBER, VISITOR, and above | List, get, search, jobs, notes, recommendations. |
| `sermon:publish` | SENIOR_PASTOR, ADMINISTRATOR, OWNER | Publish, create/list/revoke shares. |
| `sermon:manage` | OWNER (and roles granted it) | Series, create/update/archive, pipeline, transcript, generate. |

Notes are per-user even with `sermon:read`: a member cannot read another
member's notes. SAML/SCIM remain deferred.

## REST map

Authenticated, tenant from the principal:

- `POST/GET /sermons/series`, `GET/PATCH/DELETE /sermons/series/:seriesId`
- `POST/GET /sermons`, `GET /sermons/search`, `GET/PATCH/DELETE /sermons/:sermonId`
- `POST /sermons/:sermonId/publish`
- `POST /sermons/:sermonId/reprocess`
- `POST /sermons/:sermonId/generate`
- `POST /sermons/:sermonId/transcript`
- `GET /sermons/:sermonId/jobs`
- `GET /sermons/:sermonId/recommendations`
- `GET/POST /sermons/:sermonId/notes`, `PATCH/DELETE /sermons/:sermonId/notes/:noteId`
- `POST/GET /sermons/:sermonId/shares`, `DELETE /sermons/:sermonId/shares/:shareId`

JSON and urlencoded bodies are capped at 6 MiB at the Nest boundary so a 4 MiB
decoded upload fits as base64.

## Configuration

| Variable | Purpose |
|----------|---------|
| `SERMON_WORKER_ENABLED` / `SERMON_WORKER_INTERVAL_MS` / `SERMON_WORKER_BATCH_SIZE` | Processing worker cadence. Disabled under `NODE_ENV=test`. |
| `MEMORY_STT_ENDPOINT` | Shared with Memory. Blank records `TRANSCRIBE` as blocked for audio/video. |
| `APP_BASE_URL` | Share URLs, permalinks, podcast links and enclosure URLs. |

## Tests

- `packages/contracts/src/sermon/sermon.schemas.test.ts` — request shapes, media
  allow-list, create XOR rules.
- `apps/api/src/modules/sermon/sermon.utils.test.ts` — slugs, media kinds,
  scripture detection, chapterize, insight extraction.
- `apps/api/test/sermon.e2e.test.ts` — series, create + TEXT pipeline via
  `runOnce`, publish, public permalink, share revoke, notes, podcast RSS with
  a streamable enclosure, tenant isolation, archive.

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md) — module and layering rules.
- [MEMORY_ENGINE.md](./MEMORY_ENGINE.md) — where the bytes live.
- [ZION_AI.md](./ZION_AI.md) — indexing and the chat port used to summarise.
- [MULTI_TENANCY.md](./MULTI_TENANCY.md) — row-level security and `withTenant`.
- [AUTHENTICATION.md](./AUTHENTICATION.md) — principals and permissions.
- [REPOSITORY_STRUCTURE.md](./REPOSITORY_STRUCTURE.md) — where every file lives.
