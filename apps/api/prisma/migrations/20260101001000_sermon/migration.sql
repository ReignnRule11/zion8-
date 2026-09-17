-- CreateEnum
CREATE TYPE "SermonStatus" AS ENUM ('DRAFT', 'PROCESSING', 'READY', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SermonVisibility" AS ENUM ('PRIVATE', 'MEMBERS', 'PUBLIC');

-- CreateEnum
CREATE TYPE "SermonMediaKind" AS ENUM ('AUDIO', 'VIDEO', 'TEXT', 'NONE');

-- CreateEnum
CREATE TYPE "SermonDerivedStatus" AS ENUM ('NONE', 'PENDING', 'READY', 'PARTIAL', 'BLOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "SermonJobType" AS ENUM ('TRANSCRIBE', 'SCRIPTURE', 'SPEAKER', 'SUMMARIZE', 'CHAPTERIZE', 'TAG', 'INDEX');

-- CreateEnum
CREATE TYPE "SermonJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'BLOCKED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SermonTranscriptSource" AS ENUM ('DETERMINISTIC', 'STT', 'MANUAL');

-- CreateTable
CREATE TABLE "sermon_series" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "subtitle" VARCHAR(240),
    "description" TEXT,
    "visibility" "SermonVisibility" NOT NULL DEFAULT 'MEMBERS',
    "starts_on" DATE,
    "ends_on" DATE,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sermon_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sermons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "series_id" UUID,
    "slug" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "subtitle" VARCHAR(240),
    "description" TEXT,
    "speaker_name" VARCHAR(120),
    "speaker_member_id" UUID,
    "preached_at" TIMESTAMP(3),
    "location" VARCHAR(200),
    "language" VARCHAR(16) NOT NULL DEFAULT 'en',
    "status" "SermonStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "SermonVisibility" NOT NULL DEFAULT 'MEMBERS',
    "media_kind" "SermonMediaKind" NOT NULL DEFAULT 'NONE',
    "media_artifact_id" UUID,
    "duration_ms" INTEGER,
    "transcript_status" "SermonDerivedStatus" NOT NULL DEFAULT 'NONE',
    "summary_status" "SermonDerivedStatus" NOT NULL DEFAULT 'NONE',
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sermons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sermon_tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sermon_id" UUID NOT NULL,
    "tag" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sermon_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sermon_transcripts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sermon_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "language" VARCHAR(16) NOT NULL,
    "status" "SermonDerivedStatus" NOT NULL DEFAULT 'PENDING',
    "source" "SermonTranscriptSource" NOT NULL DEFAULT 'DETERMINISTIC',
    "text" TEXT NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sermon_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sermon_transcript_segments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "transcript_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "start_ms" INTEGER,
    "end_ms" INTEGER,
    "speaker_label" VARCHAR(120),
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sermon_transcript_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sermon_chapters" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sermon_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "start_ms" INTEGER,
    "end_ms" INTEGER,
    "title" VARCHAR(200) NOT NULL,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sermon_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sermon_scriptures" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sermon_id" UUID NOT NULL,
    "book" VARCHAR(40) NOT NULL,
    "chapter" INTEGER NOT NULL,
    "verse_start" INTEGER NOT NULL,
    "verse_end" INTEGER NOT NULL,
    "reference" VARCHAR(80) NOT NULL,
    "start_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sermon_scriptures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sermon_insights" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sermon_id" UUID NOT NULL,
    "summary" TEXT,
    "key_points" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "social_caption" TEXT,
    "provider" VARCHAR(60),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sermon_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sermon_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sermon_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "timestamp_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sermon_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sermon_shares" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sermon_id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sermon_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sermon_processing_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sermon_id" UUID NOT NULL,
    "type" "SermonJobType" NOT NULL,
    "status" "SermonJobStatus" NOT NULL DEFAULT 'PENDING',
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

    CONSTRAINT "sermon_processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sermon_series_tenant_id_created_at_idx" ON "sermon_series"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sermon_series_tenant_id_slug_key" ON "sermon_series"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "sermons_tenant_id_status_preached_at_idx" ON "sermons"("tenant_id", "status", "preached_at");

-- CreateIndex
CREATE INDEX "sermons_tenant_id_series_id_idx" ON "sermons"("tenant_id", "series_id");

-- CreateIndex
CREATE INDEX "sermons_tenant_id_visibility_status_idx" ON "sermons"("tenant_id", "visibility", "status");

-- CreateIndex
CREATE INDEX "sermons_tenant_id_speaker_name_idx" ON "sermons"("tenant_id", "speaker_name");

-- CreateIndex
CREATE INDEX "sermons_media_artifact_id_idx" ON "sermons"("media_artifact_id");

-- CreateIndex
CREATE UNIQUE INDEX "sermons_tenant_id_slug_key" ON "sermons"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "sermon_tags_tenant_id_tag_idx" ON "sermon_tags"("tenant_id", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "sermon_tags_sermon_id_tag_key" ON "sermon_tags"("sermon_id", "tag");

-- CreateIndex
CREATE INDEX "sermon_transcripts_tenant_id_sermon_id_is_current_idx" ON "sermon_transcripts"("tenant_id", "sermon_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "sermon_transcripts_sermon_id_version_key" ON "sermon_transcripts"("sermon_id", "version");

-- CreateIndex
CREATE INDEX "sermon_transcript_segments_tenant_id_transcript_id_idx" ON "sermon_transcript_segments"("tenant_id", "transcript_id");

-- CreateIndex
CREATE UNIQUE INDEX "sermon_transcript_segments_transcript_id_ordinal_key" ON "sermon_transcript_segments"("transcript_id", "ordinal");

-- CreateIndex
CREATE INDEX "sermon_chapters_tenant_id_sermon_id_idx" ON "sermon_chapters"("tenant_id", "sermon_id");

-- CreateIndex
CREATE UNIQUE INDEX "sermon_chapters_sermon_id_ordinal_key" ON "sermon_chapters"("sermon_id", "ordinal");

-- CreateIndex
CREATE INDEX "sermon_scriptures_tenant_id_sermon_id_idx" ON "sermon_scriptures"("tenant_id", "sermon_id");

-- CreateIndex
CREATE INDEX "sermon_scriptures_tenant_id_book_chapter_idx" ON "sermon_scriptures"("tenant_id", "book", "chapter");

-- CreateIndex
CREATE UNIQUE INDEX "sermon_insights_sermon_id_key" ON "sermon_insights"("sermon_id");

-- CreateIndex
CREATE INDEX "sermon_notes_tenant_id_sermon_id_user_id_idx" ON "sermon_notes"("tenant_id", "sermon_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sermon_shares_token_key" ON "sermon_shares"("token");

-- CreateIndex
CREATE INDEX "sermon_shares_tenant_id_sermon_id_idx" ON "sermon_shares"("tenant_id", "sermon_id");

-- CreateIndex
CREATE INDEX "sermon_processing_jobs_status_available_at_priority_idx" ON "sermon_processing_jobs"("status", "available_at", "priority");

-- CreateIndex
CREATE INDEX "sermon_processing_jobs_tenant_id_sermon_id_idx" ON "sermon_processing_jobs"("tenant_id", "sermon_id");

-- CreateIndex
CREATE INDEX "sermon_processing_jobs_tenant_id_type_status_idx" ON "sermon_processing_jobs"("tenant_id", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sermon_processing_jobs_dedupe_key_key" ON "sermon_processing_jobs"("dedupe_key");

-- AddForeignKey
ALTER TABLE "sermon_series" ADD CONSTRAINT "sermon_series_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermons" ADD CONSTRAINT "sermons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermons" ADD CONSTRAINT "sermons_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "sermon_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_tags" ADD CONSTRAINT "sermon_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_tags" ADD CONSTRAINT "sermon_tags_sermon_id_fkey" FOREIGN KEY ("sermon_id") REFERENCES "sermons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_transcripts" ADD CONSTRAINT "sermon_transcripts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_transcripts" ADD CONSTRAINT "sermon_transcripts_sermon_id_fkey" FOREIGN KEY ("sermon_id") REFERENCES "sermons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_transcript_segments" ADD CONSTRAINT "sermon_transcript_segments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_transcript_segments" ADD CONSTRAINT "sermon_transcript_segments_transcript_id_fkey" FOREIGN KEY ("transcript_id") REFERENCES "sermon_transcripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_chapters" ADD CONSTRAINT "sermon_chapters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_chapters" ADD CONSTRAINT "sermon_chapters_sermon_id_fkey" FOREIGN KEY ("sermon_id") REFERENCES "sermons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_scriptures" ADD CONSTRAINT "sermon_scriptures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_scriptures" ADD CONSTRAINT "sermon_scriptures_sermon_id_fkey" FOREIGN KEY ("sermon_id") REFERENCES "sermons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_insights" ADD CONSTRAINT "sermon_insights_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_insights" ADD CONSTRAINT "sermon_insights_sermon_id_fkey" FOREIGN KEY ("sermon_id") REFERENCES "sermons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_notes" ADD CONSTRAINT "sermon_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_notes" ADD CONSTRAINT "sermon_notes_sermon_id_fkey" FOREIGN KEY ("sermon_id") REFERENCES "sermons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_shares" ADD CONSTRAINT "sermon_shares_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_shares" ADD CONSTRAINT "sermon_shares_sermon_id_fkey" FOREIGN KEY ("sermon_id") REFERENCES "sermons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_processing_jobs" ADD CONSTRAINT "sermon_processing_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_processing_jobs" ADD CONSTRAINT "sermon_processing_jobs_sermon_id_fkey" FOREIGN KEY ("sermon_id") REFERENCES "sermons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security ---------------------------------------------------------
-- Sermon data is tenant-isolated in the database exactly like membership and
-- memory data. The session sets `app.current_tenant` and `app.is_platform_admin`;
-- the application role (`zion8_app`) has NOBYPASSRLS so even the table owner
-- cannot read across churches.

ALTER TABLE "sermon_series" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sermon_series" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sermon_series_tenant_isolation" ON "sermon_series"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "sermons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sermons" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sermons_tenant_isolation" ON "sermons"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "sermon_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sermon_tags" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sermon_tags_tenant_isolation" ON "sermon_tags"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "sermon_transcripts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sermon_transcripts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sermon_transcripts_tenant_isolation" ON "sermon_transcripts"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "sermon_transcript_segments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sermon_transcript_segments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sermon_transcript_segments_tenant_isolation" ON "sermon_transcript_segments"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "sermon_chapters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sermon_chapters" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sermon_chapters_tenant_isolation" ON "sermon_chapters"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "sermon_scriptures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sermon_scriptures" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sermon_scriptures_tenant_isolation" ON "sermon_scriptures"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "sermon_insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sermon_insights" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sermon_insights_tenant_isolation" ON "sermon_insights"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "sermon_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sermon_notes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sermon_notes_tenant_isolation" ON "sermon_notes"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "sermon_shares" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sermon_shares" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sermon_shares_tenant_isolation" ON "sermon_shares"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "sermon_processing_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sermon_processing_jobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sermon_processing_jobs_tenant_isolation" ON "sermon_processing_jobs"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
