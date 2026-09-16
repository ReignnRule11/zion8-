# 1. Keep AI vectors in PostgreSQL (pgvector), not a separate vector database

- **Status:** Accepted
- **Date:** 2026-09-16
- **Context:** Zion AI needs approximate nearest-neighbour search over church
  content. A dedicated vector database (Pinecone, Weaviate, Qdrant, Milvus) is the
  conventional choice, and the architecture documentation already anticipated an
  extraction point for an `ai-memory` service.

## Decision

Store embeddings in PostgreSQL using the `pgvector` extension, in the same
database as the source rows, with an HNSW index per active embedding model.

## Rationale

- **Isolation is a database guarantee, and this keeps it one.** Row-Level
  Security is the mechanism that prevents cross-church leakage
  ([MULTI_TENANCY](../architecture/MULTI_TENANCY.md)). A separate vector store
  moves part of the corpus outside that boundary, where isolation becomes an
  application-level filter — exactly the failure mode the platform is designed to
  avoid.
- **Embeddings stay transactionally consistent with their source.** A chunk and
  its vector are written in one transaction. With an external store, a crash
  between the two writes leaves an index that disagrees with the database, and
  the repair path is a full reconciliation job.
- **Access control is enforceable inside the query.** Permission filters
  (`sensitivity`, `required_permission`) and structured filters (date range, kind,
  entity) are ordinary SQL, evaluated by the same engine that enforces RLS.
  Applying them in a second system means duplicating the authorization model.
- **Operational surface stays small.** No new datastore to run, back up, secure,
  monitor, or version, and no second consistency model.

## Trade-offs accepted

- pgvector's HNSW search is slower than a purpose-built engine at very large
  scale, and index builds are more expensive.
- The vector column has a fixed dimension, so the active embedding model is
  pinned in a registry table and a model change is a **reindex job**, not a
  configuration toggle. Mixing dimensions in one index is impossible by
  construction, which is a correctness benefit as well as a constraint.

## Consequences

- A `ai_chunk_embeddings` row is `(chunk_id, model_id, embedding)` with a unique
  constraint, so the same chunk can carry vectors for a retired and an active
  model during a migration.
- Switching models is a backfill: write new vectors, switch the registry's active
  model, rebuild the index, and leave old vectors in place until they are no
  longer referenced.
- The extraction path is preserved: if search volume ever outgrows a single
  PostgreSQL instance, the `EmbeddingProvider` and retrieval ports already
  isolate the decision, and the corpus can be exported because it is derived data.
