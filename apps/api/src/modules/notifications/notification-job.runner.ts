import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { NotificationChannel } from '@zion8/contracts';
import { AppConfigService } from '../../common/config/app-config.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OutboxService } from '../../infrastructure/events/outbox.service';
import { NotificationService } from './notification.service';
import { backoffMs, campaignEvent, campaignStatusFromCounts } from './notification.utils';

interface ClaimedMessageRow {
  id: string;
  tenant_id: string;
  campaign_id: string;
  channel: NotificationChannel;
  address: string | null;
  subject: string | null;
  body: string;
  html: string | null;
  attempts: number;
  max_attempts: number;
  user_id: string | null;
}

/**
 * Runs campaign delivery jobs.
 *
 * Work is claimed with `FOR UPDATE SKIP LOCKED` so several workers cooperate
 * without processing the same message twice. A channel whose provider is
 * missing becomes BLOCKED with a named reason rather than a successful empty
 * send. Auth still uses NotificationService directly; this runner is only for
 * campaign messages.
 */
@Injectable()
export class NotificationJobRunner implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly outbox: OutboxService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit(): void {
    if (!this.config.notificationWorker.enabled) {
      this.logger.log('Notification job worker disabled by configuration', 'NotificationJobRunner');
      return;
    }
    const { intervalMs } = this.config.notificationWorker;
    this.timer = setInterval(() => {
      this.drain().catch((error) =>
        this.logger.warn(
          `Notification worker drain failed: ${error instanceof Error ? error.message : String(error)}`,
          'NotificationJobRunner',
        ),
      );
    }, intervalMs);
    this.timer.unref();
    this.logger.log(`Notification job worker polling every ${intervalMs}ms`, 'NotificationJobRunner');
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  async drain(): Promise<number> {
    if (this.running || this.stopped) return 0;
    this.running = true;
    try {
      return await this.runOnce(this.config.notificationWorker.batchSize);
    } finally {
      this.running = false;
    }
  }

  /** Process one batch. Exposed so tests can drive delivery deterministically. */
  async runOnce(limit = this.config.notificationWorker.batchSize): Promise<number> {
    const rows = await this.claimBatch(limit);
    const campaigns = new Set<string>();
    for (const row of rows) {
      await this.execute(row);
      campaigns.add(`${row.tenant_id}:${row.campaign_id}`);
    }
    for (const key of campaigns) {
      const [tenantId, campaignId] = key.split(':');
      if (tenantId && campaignId) await this.refreshCampaign(tenantId, campaignId);
    }
    return rows.length;
  }

  private async claimBatch(limit: number): Promise<ClaimedMessageRow[]> {
    return this.prisma.withoutScope(
      (tx) =>
        tx.$queryRaw<ClaimedMessageRow[]>`
        UPDATE "notification_messages" AS m
        SET "status" = 'SENDING',
            "started_at" = now(),
            "attempts" = m."attempts" + 1,
            "updated_at" = now()
        WHERE m."id" IN (
          SELECT "id" FROM "notification_messages"
          WHERE "status" = 'PENDING' AND "available_at" <= now()
          ORDER BY "available_at" ASC, "created_at" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        RETURNING m."id", m."tenant_id", m."campaign_id", m."channel", m."address",
                  m."subject", m."body", m."html", m."attempts", m."max_attempts", m."user_id"
      `,
    );
  }

  private async execute(row: ClaimedMessageRow): Promise<void> {
    try {
      const outcome = await this.dispatch(row);
      if (outcome.status === 'BLOCKED') {
        await this.markBlocked(row, outcome.reason);
        return;
      }
      await this.markSent(row, outcome.provider);
    } catch (error) {
      await this.markFailed(row, error);
    }
  }

  private async dispatch(
    row: ClaimedMessageRow,
  ): Promise<{ status: 'SENT'; provider: string } | { status: 'BLOCKED'; reason: string }> {
    if (!row.address) {
      return {
        status: 'BLOCKED',
        reason: row.channel === 'PUSH' ? 'NO_DEVICE_TOKEN' : 'MISSING_CONTACT',
      };
    }

    const n = this.config.notifications;
    switch (row.channel) {
      case 'EMAIL':
        if (this.config.isProduction && !n.resendApiKey) {
          return { status: 'BLOCKED', reason: 'EMAIL_NOT_CONFIGURED' };
        }
        await this.notifications.sendEmail({
          to: row.address,
          subject: row.subject ?? '',
          text: row.body,
          html: row.html ?? undefined,
        });
        return { status: 'SENT', provider: n.resendApiKey ? 'resend' : 'logging' };
      case 'SMS':
        if (this.config.isProduction && (!n.twilioAccountSid || !n.twilioAuthToken || !n.smsFrom)) {
          return { status: 'BLOCKED', reason: 'SMS_NOT_CONFIGURED' };
        }
        await this.notifications.sendSms({ to: row.address, body: row.body });
        return { status: 'SENT', provider: n.twilioAccountSid ? 'twilio' : 'logging' };
      case 'WHATSAPP':
        if (
          this.config.isProduction &&
          (!n.twilioAccountSid || !n.twilioAuthToken || !n.whatsappFrom)
        ) {
          return { status: 'BLOCKED', reason: 'WHATSAPP_NOT_CONFIGURED' };
        }
        await this.notifications.sendWhatsApp({ to: row.address, body: row.body });
        return { status: 'SENT', provider: n.whatsappFrom ? 'twilio-whatsapp' : 'logging' };
      case 'PUSH':
        if (this.config.isProduction && !n.pushEndpoint) {
          return { status: 'BLOCKED', reason: 'PUSH_NOT_CONFIGURED' };
        }
        await this.notifications.sendPush({
          token: row.address,
          title: row.subject ?? 'Zion8',
          body: row.body,
        });
        return { status: 'SENT', provider: n.pushEndpoint ? 'http-push' : 'logging' };
      case 'IN_APP':
        return { status: 'SENT', provider: 'inbox' };
      default:
        return { status: 'BLOCKED', reason: 'CHANNEL_UNSUPPORTED' };
    }
  }

  private async markSent(row: ClaimedMessageRow, provider: string): Promise<void> {
    await this.prisma.withoutScope((tx) =>
      tx.notificationMessage.update({
        where: { id: row.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          provider,
          lastError: null,
          blockedReason: null,
        },
      }),
    );
    await this.prisma.withoutScope((tx) =>
      this.outbox.enqueue(
        tx,
        campaignEvent(row.tenant_id, 'notification.message.sent', row.campaign_id, {
          messageId: row.id,
          channel: row.channel,
          provider,
        }),
      ),
    );
  }

  private async markBlocked(row: ClaimedMessageRow, reason: string): Promise<void> {
    await this.prisma.withoutScope((tx) =>
      tx.notificationMessage.update({
        where: { id: row.id },
        data: {
          status: 'BLOCKED',
          blockedReason: reason,
          lastError: null,
        },
      }),
    );
    this.logger.warn(
      `Notification message ${row.id} (${row.channel}) blocked: ${reason}`,
      'NotificationJobRunner',
    );
  }

  private async markFailed(row: ClaimedMessageRow, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const exhausted = row.attempts >= row.max_attempts;
    const delay = backoffMs(row.attempts);

    await this.prisma.withoutScope((tx) =>
      tx.notificationMessage.update({
        where: { id: row.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          lastError: message.slice(0, 4000),
          availableAt: exhausted ? new Date() : new Date(Date.now() + delay),
        },
      }),
    );

    this.logger.warn(
      `Notification message ${row.id} (${row.channel}) failed on attempt ${row.attempts}: ${message}`,
      'NotificationJobRunner',
    );
  }

  private async refreshCampaign(tenantId: string, campaignId: string): Promise<void> {
    const grouped = await this.prisma.withoutScope((tx) =>
      tx.notificationMessage.groupBy({
        by: ['status'],
        where: { tenantId, campaignId },
        _count: { _all: true },
      }),
    );
    let total = 0;
    let pending = 0;
    let failed = 0;
    let blocked = 0;
    let cancelled = 0;
    for (const entry of grouped) {
      total += entry._count._all;
      if (entry.status === 'PENDING' || entry.status === 'SENDING') pending += entry._count._all;
      if (entry.status === 'FAILED') failed += entry._count._all;
      if (entry.status === 'BLOCKED') blocked += entry._count._all;
      if (entry.status === 'CANCELLED') cancelled += entry._count._all;
    }
    const status = campaignStatusFromCounts({ total, pending, failed, blocked, cancelled });
    const data: Prisma.NotificationCampaignUpdateInput = { status };
    if (status === 'SENT' || status === 'FAILED') data.sentAt = new Date();
    await this.prisma.withoutScope((tx) =>
      tx.notificationCampaign.update({ where: { id: campaignId }, data }),
    );
  }
}
