-- Digital Memory Engine (Phase A): the archive, its immutable versions, links and
-- tags, plus the two infrastructure tables that make ingestion reliable —
-- `outbox_events` (transactional event publication) and `memory_processing_jobs`
-- (durable, retryable, explicitly-blockable background work).
--
-- Later phases add extraction text/transcripts/metadata, chunks and embeddings,
-- categories, the entity graph, timeline entries, provider usage and answers.
-- They are separate migrations so each can be reviewed and rolled out on its own.

-- CreateEnum
CREATE TYPE "MemoryArtifactKind" AS ENUM ('PHOTO', 'DOCUMENT', 'AUDIO', 'VIDEO', 'SERMON', 'WORSHIP_SET', 'MEETING_MINUTE', 'BULLETIN', 'CERTIFICATE', 'CORRESPONDENCE', 'HISTORICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "MemoryArtifactStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'PARTIAL', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MemoryArtifactOrigin" AS ENUM ('UPLOAD', 'MEMBERSHIP_DOCUMENT', 'MEMBER_IMPORT', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "CaptureDatePrecision" AS ENUM ('EXACT', 'DAY', 'MONTH', 'YEAR', 'DECADE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MemoryLinkType" AS ENUM ('MEMBER', 'FAMILY', 'DEPARTMENT', 'VISITOR', 'EVENT', 'SERMON', 'GIVING_FUND', 'TENANT');

-- CreateEnum
CREATE TYPE "MemoryJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'BLOCKED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MemoryJobType" AS ENUM ('METADATA', 'EXTRACT', 'TRANSCRIBE', 'CATEGORIZE', 'CHUNK', 'EMBED', 'INDEX', 'GRAPH', 'TIMELINE');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "memory_artifacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kind" "MemoryArtifactKind" NOT NULL DEFAULT 'OTHER',
    "status" "MemoryArtifactStatus" NOT NULL DEFAULT 'PENDING',
    "origin" "MemoryArtifactOrigin" NOT NULL DEFAULT 'UPLOAD',
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "captured_at" TIMESTAMP(3),
    "date_precision" "CaptureDatePrecision" NOT NULL DEFAULT 'UNKNOWN',
    "source_resource_type" VARCHAR(60),
    "source_resource_id" UUID,
    "current_version_id" UUID,
    "duplicate_of_artifact_id" UUID,
    "created_by_user_id" UUID,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_artifact_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "artifact_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "declared_content_type" VARCHAR(120) NOT NULL,
    "detected_content_type" VARCHAR(120),
    "storage_key" VARCHAR(512) NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_artifact_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_artifact_links" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "artifact_id" UUID NOT NULL,
    "link_type" "MemoryLinkType" NOT NULL,
    "link_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_artifact_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_artifact_tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "artifact_id" UUID NOT NULL,
    "tag" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_artifact_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "headers" JSONB NOT NULL DEFAULT '{}',
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_processing_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "artifact_id" UUID NOT NULL,
    "version_id" UUID,
    "type" "MemoryJobType" NOT NULL,
    "status" "MemoryJobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "provider" VARCHAR(60),
    "blocked_reason" VARCHAR(120),
    "last_error" TEXT,
    "result" JSONB,
    "dedupe_key" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memory_artifacts_tenant_id_created_at_idx" ON "memory_artifacts"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "memory_artifacts_tenant_id_kind_status_idx" ON "memory_artifacts"("tenant_id", "kind", "status");

-- CreateIndex
CREATE INDEX "memory_artifacts_tenant_id_captured_at_idx" ON "memory_artifacts"("tenant_id", "captured_at");

-- CreateIndex
CREATE INDEX "memory_artifacts_tenant_id_status_idx" ON "memory_artifacts"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "memory_artifacts_source_resource_type_source_resource_id_idx" ON "memory_artifacts"("source_resource_type", "source_resource_id");

-- CreateIndex
CREATE INDEX "memory_artifact_versions_tenant_id_sha256_idx" ON "memory_artifact_versions"("tenant_id", "sha256");

-- CreateIndex
CREATE INDEX "memory_artifact_versions_tenant_id_created_at_idx" ON "memory_artifact_versions"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "memory_artifact_versions_artifact_id_is_current_idx" ON "memory_artifact_versions"("artifact_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "memory_artifact_versions_artifact_id_version_key" ON "memory_artifact_versions"("artifact_id", "version");

-- CreateIndex
CREATE INDEX "memory_artifact_links_tenant_id_link_type_link_id_idx" ON "memory_artifact_links"("tenant_id", "link_type", "link_id");

-- CreateIndex
CREATE UNIQUE INDEX "memory_artifact_links_artifact_id_link_type_link_id_key" ON "memory_artifact_links"("artifact_id", "link_type", "link_id");

-- CreateIndex
CREATE INDEX "memory_artifact_tags_tenant_id_tag_idx" ON "memory_artifact_tags"("tenant_id", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "memory_artifact_tags_artifact_id_tag_key" ON "memory_artifact_tags"("artifact_id", "tag");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_tenant_id_created_at_idx" ON "outbox_events"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "outbox_events"("aggregate_type", "aggregate_id");

-- CreateIndex
CREATE INDEX "memory_processing_jobs_status_available_at_priority_idx" ON "memory_processing_jobs"("status", "available_at", "priority");

-- CreateIndex
CREATE INDEX "memory_processing_jobs_tenant_id_artifact_id_idx" ON "memory_processing_jobs"("tenant_id", "artifact_id");

-- CreateIndex
CREATE INDEX "memory_processing_jobs_tenant_id_type_status_idx" ON "memory_processing_jobs"("tenant_id", "type", "status");

-- CreateIndex
CREATE INDEX "memory_processing_jobs_dedupe_key_idx" ON "memory_processing_jobs"("dedupe_key");

-- AddForeignKey
ALTER TABLE "memory_artifacts" ADD CONSTRAINT "memory_artifacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_artifact_versions" ADD CONSTRAINT "memory_artifact_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_artifact_versions" ADD CONSTRAINT "memory_artifact_versions_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "memory_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_artifact_links" ADD CONSTRAINT "memory_artifact_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_artifact_links" ADD CONSTRAINT "memory_artifact_links_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "memory_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_artifact_tags" ADD CONSTRAINT "memory_artifact_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_artifact_tags" ADD CONSTRAINT "memory_artifact_tags_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "memory_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_processing_jobs" ADD CONSTRAINT "memory_processing_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_processing_jobs" ADD CONSTRAINT "memory_processing_jobs_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "memory_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Partial unique index: a job is unique per (tenant, dedupe_key) only when a
-- dedupe key is supplied. Ordinary jobs have none and must not collide.
CREATE UNIQUE INDEX "memory_processing_jobs_tenant_id_dedupe_key_key"
  ON "memory_processing_jobs" ("tenant_id", "dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;

-- Row level security ---------------------------------------------------------
-- Memory data is tenant-isolated in the database exactly like membership data.
-- The session sets `app.current_tenant` and `app.is_platform_admin`; the
-- application role (`zion8_app`) has NOBYPASSRLS so even the table owner cannot
-- read across churches.
--
-- `outbox_events` is the one exception: platform-level events carry a NULL
-- tenant, and the relay reads every pending event under the platform-admin
-- setting. A tenant session may only see its own rows or the tenant-less ones.

ALTER TABLE "memory_artifacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memory_artifacts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "memory_artifacts_tenant_isolation" ON "memory_artifacts"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "memory_artifact_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memory_artifact_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "memory_artifact_versions_tenant_isolation" ON "memory_artifact_versions"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "memory_artifact_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memory_artifact_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY "memory_artifact_links_tenant_isolation" ON "memory_artifact_links"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "memory_artifact_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memory_artifact_tags" FORCE ROW LEVEL SECURITY;
CREATE POLICY "memory_artifact_tags_tenant_isolation" ON "memory_artifact_tags"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "memory_processing_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memory_processing_jobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "memory_processing_jobs_tenant_isolation" ON "memory_processing_jobs"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "outbox_events_tenant_isolation" ON "outbox_events"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" IS NULL
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" IS NULL
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
