-- CreateEnum
CREATE TYPE "AiSourceType" AS ENUM ('MEMORY_ARTIFACT', 'SERMON', 'MEETING', 'MEMBER_TIMELINE', 'PRAYER_REQUEST', 'EVENT', 'MEMBER');

-- CreateEnum
CREATE TYPE "AiSensitivity" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "AiDocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'INDEXED', 'PARTIAL', 'FAILED', 'STALE');

-- AlterTable
ALTER TABLE "memory_processing_jobs" ADD COLUMN     "document_id" UUID,
ALTER COLUMN "artifact_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ai_embedding_models" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" VARCHAR(60) NOT NULL,
    "model" VARCHAR(160) NOT NULL,
    "revision" VARCHAR(80) NOT NULL DEFAULT '',
    "dimensions" INTEGER NOT NULL,
    "metric" VARCHAR(20) NOT NULL DEFAULT 'cosine',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_embedding_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_type" "AiSourceType" NOT NULL,
    "source_id" UUID NOT NULL,
    "source_version_id" UUID,
    "version_key" VARCHAR(64) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "kind" VARCHAR(60),
    "content" TEXT,
    "content_hash" VARCHAR(64) NOT NULL,
    "language" VARCHAR(16),
    "status" "AiDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "sensitivity" "AiSensitivity" NOT NULL DEFAULT 'INTERNAL',
    "required_permission" VARCHAR(60),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "occurred_at" TIMESTAMP(3),
    "char_count" INTEGER NOT NULL DEFAULT 0,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "embedding_model_id" UUID,
    "indexed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chunks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "token_count" INTEGER NOT NULL,
    "char_start" INTEGER,
    "char_end" INTEGER,
    "page" INTEGER,
    "start_ms" INTEGER,
    "end_ms" INTEGER,
    -- Full-text projection, maintained by PostgreSQL rather than the
    -- application, so it can never drift from `content`. The `simple`
    -- configuration is language-agnostic and cannot fail on an unexpected
    -- language; stemming per language is a later, per-document refinement.
    "tsv" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("content", ''))) STORED,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chunk_embeddings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "chunk_id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chunk_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_embedding_models_tenant_id_is_active_idx" ON "ai_embedding_models"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ai_embedding_models_tenant_id_provider_model_revision_key" ON "ai_embedding_models"("tenant_id", "provider", "model", "revision");

-- CreateIndex
CREATE INDEX "ai_documents_tenant_id_status_idx" ON "ai_documents"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "ai_documents_tenant_id_source_type_source_id_idx" ON "ai_documents"("tenant_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "ai_documents_tenant_id_content_hash_idx" ON "ai_documents"("tenant_id", "content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "ai_documents_tenant_id_source_type_source_id_version_key_key" ON "ai_documents"("tenant_id", "source_type", "source_id", "version_key");

-- CreateIndex
CREATE INDEX "ai_chunks_tenant_id_document_id_idx" ON "ai_chunks"("tenant_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chunks_document_id_ordinal_key" ON "ai_chunks"("document_id", "ordinal");

-- CreateIndex
CREATE INDEX "ai_chunk_embeddings_tenant_id_model_id_idx" ON "ai_chunk_embeddings"("tenant_id", "model_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chunk_embeddings_chunk_id_model_id_key" ON "ai_chunk_embeddings"("chunk_id", "model_id");

-- CreateIndex
CREATE INDEX "memory_processing_jobs_tenant_id_document_id_idx" ON "memory_processing_jobs"("tenant_id", "document_id");

-- Full-text index over the generated column. GIN is the index type that
-- supports the `@@` operator used by the lexical half of hybrid retrieval.
CREATE INDEX "ai_chunks_tsv_idx" ON "ai_chunks" USING GIN ("tsv");

-- Approximate nearest-neighbour index for the vector half of hybrid retrieval.
-- Cosine distance matches the metric recorded against the default embedding
-- model. HNSW is chosen over IVFFlat because it needs no training pass, so a
-- newly indexed corpus is searchable immediately.
CREATE INDEX "ai_chunk_embeddings_embedding_hnsw_idx"
  ON "ai_chunk_embeddings" USING hnsw ("embedding" vector_cosine_ops);

-- A processing job has exactly one subject: an archive artifact (the memory
-- worker) or an index document (the indexing worker). The constraint keeps the
-- two workers from ever claiming the same row and makes an orphaned job
-- impossible to write.
ALTER TABLE "memory_processing_jobs"
  ADD CONSTRAINT "memory_processing_jobs_subject_check"
  CHECK (("artifact_id" IS NOT NULL) <> ("document_id" IS NOT NULL));

-- AddForeignKey
ALTER TABLE "memory_processing_jobs" ADD CONSTRAINT "memory_processing_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "ai_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_embedding_models" ADD CONSTRAINT "ai_embedding_models_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_documents" ADD CONSTRAINT "ai_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chunks" ADD CONSTRAINT "ai_chunks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chunks" ADD CONSTRAINT "ai_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "ai_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chunk_embeddings" ADD CONSTRAINT "ai_chunk_embeddings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chunk_embeddings" ADD CONSTRAINT "ai_chunk_embeddings_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "ai_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chunk_embeddings" ADD CONSTRAINT "ai_chunk_embeddings_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_embedding_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security ---------------------------------------------------------
-- The index is tenant-isolated in the database exactly like the archive it is
-- built from. A vector search that forgot a tenant filter would still return
-- nothing across churches, because the session's `app.current_tenant` is part
-- of every query's row visibility. See docs/architecture/MULTI_TENANCY.md.

ALTER TABLE "ai_embedding_models" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_embedding_models" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_embedding_models_tenant_isolation" ON "ai_embedding_models"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "ai_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_documents_tenant_isolation" ON "ai_documents"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "ai_chunks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_chunks" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_chunks_tenant_isolation" ON "ai_chunks"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "ai_chunk_embeddings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_chunk_embeddings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_chunk_embeddings_tenant_isolation" ON "ai_chunk_embeddings"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
