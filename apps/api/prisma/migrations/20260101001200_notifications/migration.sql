-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationTemplateStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationMessageStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationDevicePlatform" AS ENUM ('WEB', 'IOS', 'ANDROID');

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject" VARCHAR(200),
    "body" TEXT NOT NULL,
    "html" TEXT,
    "status" "NotificationTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_audiences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "filter" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_audiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "template_id" UUID,
    "subject" VARCHAR(200),
    "body" TEXT NOT NULL,
    "html" TEXT,
    "audience_id" UUID,
    "filter" JSONB NOT NULL DEFAULT '{}',
    "audience_snapshot" JSONB NOT NULL DEFAULT '[]',
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "member_id" UUID,
    "user_id" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationMessageStatus" NOT NULL DEFAULT 'PENDING',
    "address" VARCHAR(320),
    "subject" VARCHAR(200),
    "body" TEXT NOT NULL,
    "html" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "provider" VARCHAR(60),
    "blocked_reason" VARCHAR(120),
    "last_error" TEXT,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_devices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" "NotificationDevicePlatform" NOT NULL,
    "token" VARCHAR(512) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_templates_tenant_id_channel_status_idx" ON "notification_templates"("tenant_id", "channel", "status");

-- CreateIndex
CREATE INDEX "notification_templates_tenant_id_name_idx" ON "notification_templates"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "notification_audiences_tenant_id_name_idx" ON "notification_audiences"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "notification_campaigns_tenant_id_status_created_at_idx" ON "notification_campaigns"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "notification_campaigns_tenant_id_channel_idx" ON "notification_campaigns"("tenant_id", "channel");

-- CreateIndex
CREATE INDEX "notification_campaigns_tenant_id_scheduled_at_idx" ON "notification_campaigns"("tenant_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "notification_messages_status_available_at_idx" ON "notification_messages"("status", "available_at");

-- CreateIndex
CREATE INDEX "notification_messages_tenant_id_campaign_id_status_idx" ON "notification_messages"("tenant_id", "campaign_id", "status");

-- CreateIndex
CREATE INDEX "notification_messages_tenant_id_user_id_read_at_idx" ON "notification_messages"("tenant_id", "user_id", "read_at");

-- CreateIndex
CREATE INDEX "notification_messages_tenant_id_member_id_idx" ON "notification_messages"("tenant_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_devices_tenant_id_token_key" ON "notification_devices"("tenant_id", "token");

-- CreateIndex
CREATE INDEX "notification_devices_tenant_id_user_id_idx" ON "notification_devices"("tenant_id", "user_id");

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_audiences" ADD CONSTRAINT "notification_audiences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_audience_id_fkey" FOREIGN KEY ("audience_id") REFERENCES "notification_audiences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "notification_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_devices" ADD CONSTRAINT "notification_devices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_devices" ADD CONSTRAINT "notification_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security ---------------------------------------------------------
-- Notification data is tenant-isolated in the database exactly like membership,
-- memory, sermon and accounting data. The session sets `app.current_tenant`
-- and `app.is_platform_admin`; the application role (`zion8_app`) has
-- NOBYPASSRLS so even the table owner cannot read across churches.

ALTER TABLE "notification_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY "notification_templates_tenant_isolation" ON "notification_templates"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "notification_audiences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_audiences" FORCE ROW LEVEL SECURITY;
CREATE POLICY "notification_audiences_tenant_isolation" ON "notification_audiences"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "notification_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_campaigns" FORCE ROW LEVEL SECURITY;
CREATE POLICY "notification_campaigns_tenant_isolation" ON "notification_campaigns"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "notification_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY "notification_messages_tenant_isolation" ON "notification_messages"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

ALTER TABLE "notification_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_devices" FORCE ROW LEVEL SECURITY;
CREATE POLICY "notification_devices_tenant_isolation" ON "notification_devices"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
