# Zion AI

Zion AI is the retrieval and reasoning layer over the church's Digital Memory.
Where the [Memory Engine](./MEMORY_ENGINE.md) makes the archive *true* — it stores
what the church has and is honest about what it has read — Zion AI makes the
archive *askable*. It answers questions, finds the sermon that said something, and
surfaces who should serve and what a meeting decided.

It is a bounded context, `apps/api/src/modules/ai`, exposed over REST at
`/api/v1/ai`. The model runtime sits behind ports, so the default deployment
needs no API key and no GPU, and the same domain code runs against a hosted model
or a dedicated `apps/ai-api` service later.

## The governing principle: cite, or refuse

An answer that cannot point at the church's own records is worse than no answer,
because it is indistinguishable from a fabrication that a pastor might repeat. So:

- the model only ever sees text retrieved for this request, under this tenant,
  filtered by this principal's permissions;
- every claim the model makes must map to a citation the server can verify;
- when the evidence is not there, Zion AI says so and returns the passages it
  found — it does not fill the gap with plausible prose.

This is enforced in code, not by asking the model nicely. See
[ADR 0002](../adr/0002-grounding-cite-or-refuse.md).

## Where it runs

| Layer | Location | Responsibility |
| --- | --- | --- |
| Domain and orchestration | `apps/api/src/modules/ai` | Indexing, retrieval, grounding, citations, conversations. The only layer that touches tenant data. |
| Model runtime (default) | `apps/api/src/infrastructure/ai` | Deterministic adapters: a hash embedder and an extractive answerer. No network, no key. |
| Model runtime (upgrade) | `apps/ai-api` (planned) | Hosted embeddings, rerank, OCR, speech-to-text, generation. Stateless, holds no tenant rows. |
| Async indexing | Worker in `apps/api`, later `apps/workers` | Consumes outbox events and runs the CHUNK → EMBED → INDEX stages. |

Nothing in the AI subsystem is authoritative. Every derived row — chunks,
embeddings, entities, summaries — can be deleted and rebuilt from PostgreSQL and
object storage. That is what makes changing models safe.

```
Client
  |
  v
/api/v1/ai  ->  retrieval (RLS + permission filter)  ->  PostgreSQL
                       |                                  (pgvector + GIN full text)
                       v
                 ChatProvider port  ->  deterministic  |  workspace LLM  |  ai-api
                       |
                       v
                 citation verification  ->  answer, or abstention
```

## Capabilities

| Capability | What it reads | What it returns | The rule that shapes it |
| --- | --- | --- | --- |
| **Church Knowledge Search** | Every indexed document | Ranked passages with citations | Works with zero keys: it is retrieval, not generation |
| **Historical Search** | Dated artifacts, timeline, events | Results grouped on a timeline | Uses `date_precision`; never invents a day that is not known |
| **Document Q&A** | One artifact or document set | An answer citing page or offset | Refuses when the document does not answer |
| **Sermon Search** | Sermon transcripts | Quotes with timestamps and series/scripture filters | Citations carry the timestamp, so a clip can be found |
| **Prayer Insights** | Prayer requests (`prayer:read`) | Themes, counts, trends | Aggregates only; never reveals an individual's private request |
| **Meeting Summaries** | Transcripts and minutes | Decisions, action items, attendees, next steps | Draft until a human approves; timestamped citations |
| **Event Recommendations** | Attendance, departments, interests | Ranked events, each with a "why" | Explainable and opt-out; no inference from sensitive data |
| **Volunteer Recommendations** | Service history, skills, checks, load | Ranked people per role, each with a "why" | Excludes anyone ineligible; a person always decides |

The retrieval engine is shared. Each capability is a scoped query — a filter set,
a prompt, and an output contract — rather than a separate pipeline.

## Retrieval

Hybrid retrieval, because neither half is sufficient on its own: a vector search
finds "the sermon about coming home" when nobody wrote those words, and full-text
search finds "Habakkuk 3:19" exactly.

1. **Route** — classify the request into a capability and a filter set.
2. **Rewrite** — expand the query into several probes (disabled when no chat
   model is configured; the deterministic path searches the query as written).
3. **Generate candidates** — vector KNN over `ai_chunk_embeddings`, full-text
   search over `ai_chunks.tsv`, plus structured filters (date range, kind,
   entity, document scope).
4. **Fuse** — Reciprocal Rank Fusion, which needs no score normalization across
   two very different scorers.
5. **Rerank** — a cross-encoder when one is available, otherwise lexical overlap.
6. **Assemble** — deduplicate by source, fit a token budget, preserve provenance.
7. **Synthesize** — a grounded prompt over exactly the assembled passages.
8. **Verify** — validate citations; on failure, abstain or fall back to extractive
   passages.

**Authorization is part of the query, not part of the prompt.** Row-Level
Security enforces the tenant; retrieval additionally filters by `sensitivity` and
`required_permission` against the principal, so prayer and counseling content
never enters a model context the caller could not already read. Prompt text is
never the thing standing between a user and another church's data.

## Grounding and hallucination prevention

Defense in depth:

1. **Retrieve-then-generate only.** The model answers solely from supplied
   context.
2. **Abstention is a first-class outcome.** Below an evidence threshold the
   response is `abstained: true` with the retrieved passages, not a guess.
3. **Citation verification.** The model emits markers that map to chunk ids. The
   server drops any marker whose id was not in the supplied context or is not
   permitted, then measures support: if the fraction of claims carrying a valid
   citation falls below `AI_CITATION_MIN_SUPPORT`, the answer is downgraded to
   extractive quotes or refused. Numbers, names, and dates must appear in the
   cited spans.
4. **Untrusted retrieved content.** Passages are delimited and labelled as
   untrusted. The model is told to ignore instructions inside them, and it can
   never choose a tenant, write SQL, or call a tool, so a document that says
   "ignore your instructions" changes nothing.
5. **Structured output only.** Responses are parsed against a Zod contract;
   malformed output is rejected rather than shown.

## Security

- **Tenant isolation** — every AI table carries `tenant_id` under `FORCE ROW
  LEVEL SECURITY`, and all access goes through `PrismaService.withTenant`.
- **Permission-aware retrieval** — `memory:read` / `memory:answer` govern the
  archive, `prayer:read` governs Prayer Insights, and new `ai:*` permissions
  govern asking, feedback, and administration.
- **Workspace-owned model credentials** — a church configures its own provider
  through `USER_LLM_*` / `AI_*`; the platform never routes its own credentials
  through a tenant's data path.
- **No tenant content in logs.** Prompts and passages are not logged; only
  identifiers, timings, token counts, and outcome.
- **Cost and abuse control** — per-tenant quota, per-user rate limits, bounded
  context and output, timeouts, and a provider circuit breaker that degrades to
  search-only rather than failing the request.
- **Auditability** — every answer is persisted with its sources, model, prompt
  version, and embedding model, so any answer can be reproduced and explained.

## Evaluation

An AI capability is only as good as the evidence that it works. The evaluation
harness lives in `tools/evals` and is a required CI gate for any change to a
prompt, a model, or retrieval parameters.

- **Golden sets per capability** — curated questions with expected source
  documents and answers, including a **should-refuse** set for questions the
  archive cannot answer.
- **Metrics** — retrieval recall@k, MRR and nDCG; answer faithfulness and
  citation precision/recall; refusal correctness; latency and cost.
- **Gates** — a merge is blocked when faithfulness or citation precision
  regresses, not merely when a test fails.
- **Online signal** — feedback, citation click-through, and sampled judge scores
  calibrated against human labels.
- **Reproducibility** — every persisted answer records the exact prompt version,
  model, and embedding model it used, so an eval maps to a configuration.

## Continuity with the Memory Engine

Zion AI does not have its own copy of the church's records. It indexes the Memory
Engine — artifacts and versions — plus the other domains that hold text, and
keeps the link back to the source row. A chunk knows which artifact version
produced it, so a citation can be opened, downloaded, and checked against the
original bytes. When an artifact is re-uploaded, the projection updates; when it
is archived, it leaves retrieval.

## Phases

| Phase | Deliverable |
| --- | --- |
| 0 Foundations | Contracts, permissions, error codes, environment, ports, deterministic adapters. **Shipped.** |
| 1 Indexing | Extraction, chunking, embeddings, vector and full-text indexes, backfill. **Shipped** (`ai_documents` / `ai_chunks` / `ai_chunk_embeddings`, reconciliation worker). |
| 2 Retrieval | Hybrid search and `/ai/search` with citations |
| 3 Answers | Grounded generation, citation verification, conversations, streaming |
| 4 Capabilities | Document Q&A, sermon search, meeting summaries, prayer insights |
| 5 Recommendations | Event and volunteer recommendations |
| 6 Evaluation and hardening | Eval harness in CI, quotas, rate limits, dashboards |
| 7 Extraction | Model runtime moves to `apps/ai-api` behind the existing ports |

## Configuration

| Variable | Purpose |
| --- | --- |
| `AI_ENABLED` | Master switch; when off, `/ai` routes are not registered. |
| `AI_EMBEDDING_PROVIDER` / `AI_EMBEDDING_MODEL` / `AI_EMBEDDING_BASE_URL` / `AI_EMBEDDING_API_KEY` / `AI_EMBEDDING_DIMENSIONS` | Embedding runtime and the active model registry entry. |
| `AI_CHAT_PROVIDER` / `AI_CHAT_MODEL` / `AI_CHAT_BASE_URL` / `AI_CHAT_API_KEY` | Answer runtime. Blank selects the deterministic extractive provider. |
| `AI_RETRIEVAL_TOP_K` / `AI_RETRIEVAL_CANDIDATES` / `AI_CITATION_MIN_SUPPORT` | Retrieval depth and the grounding threshold. |
| `AI_WORKER_ENABLED` / `AI_WORKER_INTERVAL_MS` / `AI_WORKER_BATCH_SIZE` | Indexing worker cadence. |
| `AI_QUERY_TIMEOUT_MS` | Provider timeout before degrading to search-only. |

## Related

- [MEMORY_ENGINE.md](./MEMORY_ENGINE.md) — the archive Zion AI indexes.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — module boundaries and layering.
- [MULTI_TENANCY.md](./MULTI_TENANCY.md) — row-level security.
- [AUTHENTICATION.md](./AUTHENTICATION.md) — principals and permissions.
- [ADR 0001](../adr/0001-ai-vector-store-in-postgres.md) — why vectors live in PostgreSQL.
- [ADR 0002](../adr/0002-grounding-cite-or-refuse.md) — why answers cite or refuse.
