-- Membership: members, families, relationships, visitors, attendance,
-- departments, volunteer roles, timeline, documents, and AI summaries.
--
-- Every new table is tenant-scoped and therefore FORCE ROW LEVEL SECURITY, the
-- same posture as the rest of the schema. Membership data is the most sensitive
-- data the platform holds, so isolation is enforced in the database rather than
-- trusted to application filters: even the table owner cannot read across
-- tenants, and the application role (`zion8_app`) has NOBYPASSRLS.
--
-- Actor columns (`recorded_by_user_id`, `uploaded_by_user_id`, ...) are
-- denormalized UUID references without foreign keys. The authoritative record of
-- who did what is `audit_logs`; keeping the actor as a plain column avoids
-- coupling every operational table to the global `users` table and the cascade
-- surprises that come with it. `members.created_by_user_id` is the exception: it
-- is a real FK because the creating administrator is part of the record itself.

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRANSFERRED', 'DECEASED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MemberGender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'WIDOWED', 'DIVORCED', 'SEPARATED', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('HEAD', 'SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'RELATIVE', 'GUARDIAN', 'WARD', 'OTHER');

-- CreateEnum
CREATE TYPE "FamilyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'GUARDIAN', 'WARD', 'GRANDPARENT', 'GRANDCHILD', 'RELATIVE', 'MENTOR', 'MENTEE', 'FRIEND', 'EMERGENCY_CONTACT', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitorStatus" AS ENUM ('NEW', 'FOLLOW_UP', 'RETURNING', 'CONNECTED', 'CONVERTED', 'DORMANT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VisitorSource" AS ENUM ('INVITED_BY_MEMBER', 'WALK_IN', 'EVENT', 'WEBSITE', 'OUTREACH', 'SOCIAL_MEDIA', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceSessionKind" AS ENUM ('SERVICE', 'EVENT', 'CLASS', 'GROUP', 'OUTREACH', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('MANUAL', 'SELF', 'QR', 'KIOSK', 'IMPORT');

-- CreateEnum
CREATE TYPE "DepartmentKind" AS ENUM ('MINISTRY', 'CHOIR', 'USHERING', 'MEDIA', 'CHILDREN', 'YOUTH', 'ADULT', 'OUTREACH', 'PRAYER', 'HOSPITALITY', 'ADMINISTRATION', 'OTHER');

-- CreateEnum
CREATE TYPE "DepartmentMemberRole" AS ENUM ('LEADER', 'ASSISTANT_LEADER', 'COORDINATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "DepartmentMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VolunteerCommitment" AS ENUM ('ONE_OFF', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'SEASONAL', 'ON_CALL');

-- CreateEnum
CREATE TYPE "VolunteerAssignmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "TimelineEventType" AS ENUM ('MEMBERSHIP', 'ATTENDANCE', 'RELATIONSHIP', 'FAMILY', 'DEPARTMENT', 'VOLUNTEER', 'DOCUMENT', 'VISITOR', 'CONVERSION', 'NOTE', 'SUMMARY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('IDENTITY', 'CERTIFICATE', 'CONSENT', 'MEDICAL', 'FINANCIAL', 'PASTORAL', 'LEGAL', 'MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'AVAILABLE', 'ARCHIVED', 'FAILED');

-- CreateEnum
CREATE TYPE "SummaryStatus" AS ENUM ('FRESH', 'STALE', 'GENERATING', 'FAILED');

-- CreateEnum
CREATE TYPE "SummaryProviderKind" AS ENUM ('DETERMINISTIC', 'LLM');

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "first_name" VARCHAR(120) NOT NULL,
    "middle_name" VARCHAR(120),
    "last_name" VARCHAR(120) NOT NULL,
    "preferred_name" VARCHAR(120),
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "gender" "MemberGender" NOT NULL DEFAULT 'UNDISCLOSED',
    "marital_status" "MaritalStatus" NOT NULL DEFAULT 'UNDISCLOSED',
    "date_of_birth" DATE,
    "email" VARCHAR(320),
    "phone" VARCHAR(32),
    "photo_url" VARCHAR(2048),
    "address_line1" VARCHAR(180),
    "address_line2" VARCHAR(180),
    "city" VARCHAR(120),
    "region" VARCHAR(120),
    "postal_code" VARCHAR(32),
    "country_code" VARCHAR(2),
    "joined_at" DATE,
    "baptized_at" DATE,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "families" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "FamilyStatus" NOT NULL DEFAULT 'ACTIVE',
    "address_line1" VARCHAR(180),
    "address_line2" VARCHAR(180),
    "city" VARCHAR(120),
    "region" VARCHAR(120),
    "postal_code" VARCHAR(32),
    "country_code" VARCHAR(2),
    "home_phone" VARCHAR(32),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "role" "FamilyRole" NOT NULL DEFAULT 'OTHER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_relationships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "from_member_id" UUID NOT NULL,
    "to_member_id" UUID NOT NULL,
    "type" "RelationshipType" NOT NULL,
    "notes" VARCHAR(1000),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "first_name" VARCHAR(120) NOT NULL,
    "last_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(32),
    "status" "VisitorStatus" NOT NULL DEFAULT 'NEW',
    "source" "VisitorSource" NOT NULL DEFAULT 'OTHER',
    "first_visit_at" TIMESTAMP(3),
    "last_visit_at" TIMESTAMP(3),
    "visit_count" INTEGER NOT NULL DEFAULT 0,
    "invited_by_member_id" UUID,
    "assigned_to_user_id" UUID,
    "address_line1" VARCHAR(180),
    "city" VARCHAR(120),
    "country_code" VARCHAR(2),
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "follow_up_at" TIMESTAMP(3),
    "converted_member_id" UUID,
    "converted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_visits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "visitor_id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "service_name" VARCHAR(120),
    "attended" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(1000),
    "recorded_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "kind" "AttendanceSessionKind" NOT NULL DEFAULT 'SERVICE',
    "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'OPEN',
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "location" VARCHAR(160),
    "department_id" UUID,
    "expected_count" INTEGER,
    "notes" TEXT,
    "recorded_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "member_id" UUID,
    "visitor_id" UUID,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "method" "AttendanceMethod" NOT NULL DEFAULT 'MANUAL',
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" VARCHAR(1000),
    "recorded_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "kind" "DepartmentKind" NOT NULL DEFAULT 'MINISTRY',
    "description" TEXT,
    "leader_member_id" UUID,
    "meeting_day" VARCHAR(9),
    "meeting_time" VARCHAR(5),
    "location" VARCHAR(160),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "role" "DepartmentMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "DepartmentMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "department_id" UUID,
    "commitment" "VolunteerCommitment" NOT NULL DEFAULT 'WEEKLY',
    "required_count" INTEGER NOT NULL DEFAULT 1,
    "requires_background_check" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "volunteer_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "status" "VolunteerAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "background_check_at" TIMESTAMP(3),
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "volunteer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_timeline_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "type" "TimelineEventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "summary" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "source_resource_type" VARCHAR(64),
    "source_resource_id" VARCHAR(128),
    "dedupe_key" VARCHAR(160),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "file_name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(120) NOT NULL,
    "size_bytes" INTEGER NOT NULL DEFAULT 0,
    "checksum" VARCHAR(128),
    "storage_key" VARCHAR(512),
    "notes" TEXT,
    "expires_at" TIMESTAMP(3),
    "uploaded_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_ai_summaries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "status" "SummaryStatus" NOT NULL DEFAULT 'FRESH',
    "provider" "SummaryProviderKind" NOT NULL DEFAULT 'DETERMINISTIC',
    "model" VARCHAR(120),
    "content" TEXT,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "facts" JSONB,
    "generated_at" TIMESTAMP(3),
    "source_version" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_ai_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "members_tenant_id_status_idx" ON "members"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "members_tenant_id_last_name_first_name_idx" ON "members"("tenant_id", "last_name", "first_name");

-- CreateIndex
CREATE INDEX "members_user_id_idx" ON "members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "members_tenant_id_email_key" ON "members"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "families_tenant_id_status_idx" ON "families"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "families_tenant_id_name_idx" ON "families"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "family_members_tenant_id_idx" ON "family_members"("tenant_id");

-- CreateIndex
CREATE INDEX "family_members_member_id_idx" ON "family_members"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_family_id_member_id_key" ON "family_members"("family_id", "member_id");

-- CreateIndex
CREATE INDEX "member_relationships_tenant_id_idx" ON "member_relationships"("tenant_id");

-- CreateIndex
CREATE INDEX "member_relationships_to_member_id_idx" ON "member_relationships"("to_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_relationships_from_member_id_to_member_id_type_key" ON "member_relationships"("from_member_id", "to_member_id", "type");

-- CreateIndex
CREATE INDEX "visitors_tenant_id_status_idx" ON "visitors"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "visitors_tenant_id_last_name_first_name_idx" ON "visitors"("tenant_id", "last_name", "first_name");

-- CreateIndex
CREATE INDEX "visitors_tenant_id_follow_up_at_idx" ON "visitors"("tenant_id", "follow_up_at");

-- CreateIndex
CREATE INDEX "visitor_visits_tenant_id_occurred_at_idx" ON "visitor_visits"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "visitor_visits_visitor_id_occurred_at_idx" ON "visitor_visits"("visitor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "attendance_sessions_tenant_id_occurred_at_idx" ON "attendance_sessions"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "attendance_sessions_tenant_id_kind_status_idx" ON "attendance_sessions"("tenant_id", "kind", "status");

-- CreateIndex
CREATE INDEX "attendance_sessions_department_id_idx" ON "attendance_sessions"("department_id");

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_checked_in_at_idx" ON "attendance_records"("tenant_id", "checked_in_at");

-- CreateIndex
CREATE INDEX "attendance_records_member_id_idx" ON "attendance_records"("member_id");

-- CreateIndex
CREATE INDEX "attendance_records_visitor_id_idx" ON "attendance_records"("visitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_session_id_member_id_key" ON "attendance_records"("session_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_session_id_visitor_id_key" ON "attendance_records"("session_id", "visitor_id");

-- CreateIndex
CREATE INDEX "departments_tenant_id_kind_is_active_idx" ON "departments"("tenant_id", "kind", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenant_id_name_key" ON "departments"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "department_members_tenant_id_idx" ON "department_members"("tenant_id");

-- CreateIndex
CREATE INDEX "department_members_member_id_idx" ON "department_members"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_members_department_id_member_id_key" ON "department_members"("department_id", "member_id");

-- CreateIndex
CREATE INDEX "volunteer_roles_tenant_id_is_active_idx" ON "volunteer_roles"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "volunteer_roles_department_id_idx" ON "volunteer_roles"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_roles_tenant_id_name_key" ON "volunteer_roles"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "volunteer_assignments_tenant_id_status_idx" ON "volunteer_assignments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "volunteer_assignments_member_id_idx" ON "volunteer_assignments"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_assignments_role_id_member_id_key" ON "volunteer_assignments"("role_id", "member_id");

-- CreateIndex
CREATE INDEX "member_timeline_entries_tenant_id_member_id_occurred_at_idx" ON "member_timeline_entries"("tenant_id", "member_id", "occurred_at");

-- CreateIndex
CREATE INDEX "member_timeline_entries_tenant_id_type_idx" ON "member_timeline_entries"("tenant_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "member_timeline_entries_member_id_dedupe_key_key" ON "member_timeline_entries"("member_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "member_documents_tenant_id_member_id_category_idx" ON "member_documents"("tenant_id", "member_id", "category");

-- CreateIndex
CREATE INDEX "member_documents_tenant_id_status_idx" ON "member_documents"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "member_ai_summaries_member_id_key" ON "member_ai_summaries"("member_id");

-- CreateIndex
CREATE INDEX "member_ai_summaries_tenant_id_status_idx" ON "member_ai_summaries"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "families" ADD CONSTRAINT "families_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_relationships" ADD CONSTRAINT "member_relationships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_relationships" ADD CONSTRAINT "member_relationships_from_member_id_fkey" FOREIGN KEY ("from_member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_relationships" ADD CONSTRAINT "member_relationships_to_member_id_fkey" FOREIGN KEY ("to_member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_invited_by_member_id_fkey" FOREIGN KEY ("invited_by_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_visits" ADD CONSTRAINT "visitor_visits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_visits" ADD CONSTRAINT "visitor_visits_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_roles" ADD CONSTRAINT "volunteer_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_roles" ADD CONSTRAINT "volunteer_roles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_assignments" ADD CONSTRAINT "volunteer_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_assignments" ADD CONSTRAINT "volunteer_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "volunteer_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_assignments" ADD CONSTRAINT "volunteer_assignments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_timeline_entries" ADD CONSTRAINT "member_timeline_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_timeline_entries" ADD CONSTRAINT "member_timeline_entries_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_documents" ADD CONSTRAINT "member_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_documents" ADD CONSTRAINT "member_documents_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_ai_summaries" ADD CONSTRAINT "member_ai_summaries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_ai_summaries" ADD CONSTRAINT "member_ai_summaries_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Integrity constraints -----------------------------------------------------
-- A relationship must connect two different people. The domain refuses this
-- too; the constraint is the last line of defence against a bad write.
ALTER TABLE "member_relationships"
  ADD CONSTRAINT "member_relationships_distinct_members_check"
  CHECK ("from_member_id" <> "to_member_id");

-- An attendance record is either a member or a visitor, never both and never
-- neither. This is what lets a first-time guest be counted on the day they
-- arrive, before any member record exists.
ALTER TABLE "attendance_records"
  ADD CONSTRAINT "attendance_records_attendee_check"
  CHECK (("member_id" IS NOT NULL) <> ("visitor_id" IS NOT NULL));

-- Row level security ---------------------------------------------------------
-- Each table is isolated by tenant_id. The session sets:
--   app.current_tenant     -> uuid of the active church workspace ('' when unset)
--   app.is_platform_admin  -> 'true' for trusted system operations

ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "members" FORCE ROW LEVEL SECURITY;
CREATE POLICY "members_tenant_isolation" ON "members"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "families" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "families" FORCE ROW LEVEL SECURITY;
CREATE POLICY "families_tenant_isolation" ON "families"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "family_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "family_members" FORCE ROW LEVEL SECURITY;
CREATE POLICY "family_members_tenant_isolation" ON "family_members"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "member_relationships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_relationships" FORCE ROW LEVEL SECURITY;
CREATE POLICY "member_relationships_tenant_isolation" ON "member_relationships"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "visitors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visitors" FORCE ROW LEVEL SECURITY;
CREATE POLICY "visitors_tenant_isolation" ON "visitors"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "visitor_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visitor_visits" FORCE ROW LEVEL SECURITY;
CREATE POLICY "visitor_visits_tenant_isolation" ON "visitor_visits"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "attendance_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "attendance_sessions_tenant_isolation" ON "attendance_sessions"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "attendance_records_tenant_isolation" ON "attendance_records"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "departments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "departments_tenant_isolation" ON "departments"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "department_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "department_members" FORCE ROW LEVEL SECURITY;
CREATE POLICY "department_members_tenant_isolation" ON "department_members"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "volunteer_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "volunteer_roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "volunteer_roles_tenant_isolation" ON "volunteer_roles"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "volunteer_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "volunteer_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "volunteer_assignments_tenant_isolation" ON "volunteer_assignments"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "member_timeline_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_timeline_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY "member_timeline_entries_tenant_isolation" ON "member_timeline_entries"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "member_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY "member_documents_tenant_isolation" ON "member_documents"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "member_ai_summaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_ai_summaries" FORCE ROW LEVEL SECURITY;
CREATE POLICY "member_ai_summaries_tenant_isolation" ON "member_ai_summaries"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
