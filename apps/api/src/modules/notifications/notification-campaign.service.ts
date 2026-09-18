import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type NotificationAnalytics,
  type NotificationAnalyticsQuery,
  type NotificationCampaign,
  type NotificationCampaignCreateRequest,
  type NotificationCampaignListQuery,
  type NotificationCampaignPage,
  type NotificationCampaignScheduleRequest,
  type NotificationCampaignUpdateRequest,
  type NotificationChannel,
  type NotificationMessageListQuery,
  type NotificationMessagePage,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { AppConfigService } from '../../common/config/app-config.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OutboxService } from '../../infrastructure/events/outbox.service';
import { AuditService } from '../audit/audit.service';
import { NotificationTemplateService } from './notification-template.service';
import {
  DEFAULT_MAX_ATTEMPTS,
  addressFor,
  blockedReasonFor,
  campaignEvent,
  emptyAnalytics,
  memberWhere,
  pageArgs,
  parseAudienceFilter,
  renderTemplate,
  toCampaign,
  toMessage,
  varsFromMember,
} from './notification.utils';

type MemberRow = {
  id: string;
  userId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
};

@Injectable()
export class NotificationCampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly templates: NotificationTemplateService,
    private readonly config: AppConfigService,
  ) {}

  async create(
    tenantId: string,
    actorUserId: string,
    input: NotificationCampaignCreateRequest,
  ): Promise<NotificationCampaign> {
    const copy = await this.resolveCopy(tenantId, input.channel, input);
    const filter = input.filter ?? {};
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationCampaign.create({
        data: {
          tenantId,
          name: input.name,
          channel: input.channel,
          templateId: input.templateId ?? null,
          subject: copy.subject,
          body: copy.body,
          html: copy.html,
          audienceId: input.audienceId ?? null,
          filter: filter as Prisma.InputJsonValue,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          createdByUserId: actorUserId,
        },
      }),
    );
    return this.withCounts(tenantId, row);
  }

  async list(tenantId: string, query: NotificationCampaignListQuery): Promise<NotificationCampaignPage> {
    const where: Prisma.NotificationCampaignWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.notificationCampaign.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }],
          skip,
          take,
        }),
        tx.notificationCampaign.count({ where }),
      ]),
    );
    const items = await Promise.all(rows.map((row) => this.withCounts(tenantId, row)));
    return { items, total, limit: query.limit, offset: query.offset };
  }

  async get(tenantId: string, campaignId: string): Promise<NotificationCampaign> {
    const row = await this.findCampaign(tenantId, campaignId);
    return this.withCounts(tenantId, row);
  }

  async update(
    tenantId: string,
    campaignId: string,
    input: NotificationCampaignUpdateRequest,
  ): Promise<NotificationCampaign> {
    const existing = await this.findCampaign(tenantId, campaignId);
    if (existing.status !== 'DRAFT') {
      throw new DomainError(
        'NOTIFICATION_CAMPAIGN_NOT_SENDABLE',
        'Only a draft campaign can be edited',
      );
    }
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationCampaign.update({
        where: { id: campaignId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.subject !== undefined ? { subject: input.subject } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.html !== undefined ? { html: input.html } : {}),
          ...(input.audienceId !== undefined ? { audienceId: input.audienceId } : {}),
          ...(input.filter !== undefined
            ? { filter: (input.filter ?? {}) as Prisma.InputJsonValue }
            : {}),
          ...(input.scheduledAt !== undefined
            ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null }
            : {}),
        },
      }),
    );
    return this.withCounts(tenantId, row);
  }

  async send(tenantId: string, actorUserId: string, campaignId: string): Promise<NotificationCampaign> {
    return this.expand(tenantId, actorUserId, campaignId, new Date(), 'SENDING');
  }

  async schedule(
    tenantId: string,
    actorUserId: string,
    campaignId: string,
    input: NotificationCampaignScheduleRequest,
  ): Promise<NotificationCampaign> {
    const when = new Date(input.scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      throw new DomainError(
        'NOTIFICATION_CAMPAIGN_NOT_SENDABLE',
        'A schedule time must be in the future',
      );
    }
    return this.expand(tenantId, actorUserId, campaignId, when, 'SCHEDULED');
  }

  async cancel(tenantId: string, actorUserId: string, campaignId: string): Promise<NotificationCampaign> {
    const existing = await this.findCampaign(tenantId, campaignId);
    if (existing.status === 'SENT' || existing.status === 'CANCELLED') {
      throw new DomainError(
        'NOTIFICATION_CAMPAIGN_NOT_SENDABLE',
        'That campaign can no longer be cancelled',
      );
    }
    const now = new Date();
    await this.prisma.withTenant(tenantId, async (tx) => {
      await tx.notificationCampaign.update({
        where: { id: campaignId },
        data: { status: 'CANCELLED', cancelledAt: now },
      });
      await tx.notificationMessage.updateMany({
        where: { tenantId, campaignId, status: { in: ['PENDING', 'SENDING'] } },
        data: { status: 'CANCELLED' },
      });
      await this.outbox.enqueue(
        tx,
        campaignEvent(tenantId, 'notification.campaign.cancelled', campaignId, {
          cancelledBy: actorUserId,
        }),
      );
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'notification.campaign.cancelled',
          resourceType: 'notification.campaign',
          resourceId: campaignId,
        },
        tx,
      );
    });
    return this.get(tenantId, campaignId);
  }

  async listMessages(
    tenantId: string,
    campaignId: string,
    query: NotificationMessageListQuery,
  ): Promise<NotificationMessagePage> {
    await this.findCampaign(tenantId, campaignId);
    const where: Prisma.NotificationMessageWhereInput = {
      tenantId,
      campaignId,
      ...(query.status ? { status: query.status } : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.notificationMessage.findMany({
          where,
          orderBy: [{ createdAt: 'asc' }],
          skip,
          take,
        }),
        tx.notificationMessage.count({ where }),
      ]),
    );
    return { items: rows.map(toMessage), total, limit: query.limit, offset: query.offset };
  }

  async analytics(
    tenantId: string,
    campaignId: string | null,
    query: NotificationAnalyticsQuery = {},
  ): Promise<NotificationAnalytics> {
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;
    const where: Prisma.NotificationMessageWhereInput = {
      tenantId,
      ...(campaignId ? { campaignId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };
    const [campaignCount, grouped] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        campaignId
          ? Promise.resolve(1)
          : tx.notificationCampaign.count({
              where: {
                tenantId,
                ...(from || to
                  ? {
                      createdAt: {
                        ...(from ? { gte: from } : {}),
                        ...(to ? { lte: to } : {}),
                      },
                    }
                  : {}),
              },
            }),
        tx.notificationMessage.groupBy({
          by: ['channel', 'status'],
          where,
          _count: { _all: true },
        }),
      ]),
    );

    if (grouped.length === 0) {
      return emptyAnalytics(campaignId, query.from ?? null, query.to ?? null);
    }

    const totals = {
      recipients: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      blocked: 0,
      cancelled: 0,
      pending: 0,
      read: 0,
    };
    const byChannel = new Map<
      NotificationChannel,
      { recipients: number; sent: number; failed: number; blocked: number }
    >();

    for (const row of grouped) {
      const count = row._count._all;
      totals.recipients += count;
      if (row.status === 'SENT') totals.sent += count;
      if (row.status === 'DELIVERED') totals.delivered += count;
      if (row.status === 'FAILED') totals.failed += count;
      if (row.status === 'BLOCKED') totals.blocked += count;
      if (row.status === 'CANCELLED') totals.cancelled += count;
      if (row.status === 'PENDING' || row.status === 'SENDING') totals.pending += count;
      const channel = byChannel.get(row.channel) ?? {
        recipients: 0,
        sent: 0,
        failed: 0,
        blocked: 0,
      };
      channel.recipients += count;
      if (row.status === 'SENT' || row.status === 'DELIVERED') channel.sent += count;
      if (row.status === 'FAILED') channel.failed += count;
      if (row.status === 'BLOCKED') channel.blocked += count;
      byChannel.set(row.channel, channel);
    }

    const readCount = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationMessage.count({
        where: { ...where, readAt: { not: null } },
      }),
    );

    return {
      campaignId,
      from: query.from ?? null,
      to: query.to ?? null,
      campaigns: campaignCount,
      ...totals,
      read: readCount,
      byChannel: [...byChannel.entries()].map(([channel, counts]) => ({ channel, ...counts })),
    };
  }

  private async expand(
    tenantId: string,
    actorUserId: string,
    campaignId: string,
    availableAt: Date,
    nextStatus: 'SENDING' | 'SCHEDULED',
  ): Promise<NotificationCampaign> {
    const campaign = await this.findCampaign(tenantId, campaignId);
    if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
      throw new DomainError(
        'NOTIFICATION_CAMPAIGN_NOT_SENDABLE',
        'Only a draft or scheduled campaign can be sent',
      );
    }

    const existingCount = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationMessage.count({ where: { tenantId, campaignId } }),
    );
    if (existingCount > 0 && campaign.status !== 'DRAFT') {
      await this.prisma.withTenant(tenantId, (tx) =>
        tx.notificationCampaign.update({
          where: { id: campaignId },
          data: {
            status: nextStatus,
            scheduledAt: nextStatus === 'SCHEDULED' ? availableAt : campaign.scheduledAt,
          },
        }),
      );
      return this.get(tenantId, campaignId);
    }

    const filter = await this.resolveFilter(tenantId, campaign.audienceId, campaign.filter);
    const members = await this.prisma.withTenant(tenantId, (tx) =>
      tx.member.findMany({
        where: memberWhere(tenantId, filter),
        select: {
          id: true,
          userId: true,
          firstName: true,
          middleName: true,
          lastName: true,
          preferredName: true,
          email: true,
          phone: true,
        },
      }),
    );
    if (members.length === 0) {
      throw new DomainError('NOTIFICATION_CAMPAIGN_EMPTY', 'That audience matched nobody');
    }

    const church = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    );
    const churchName = church?.name ?? 'Zion8';
    const capabilities = this.channelCapabilities();
    const pushTokens = await this.pushTokens(tenantId, members);

    const snapshot = members.map((member) => member.id);
    const eventType =
      nextStatus === 'SCHEDULED' ? 'notification.campaign.scheduled' : 'notification.campaign.sent';

    await this.prisma.withTenant(tenantId, async (tx) => {
      await tx.notificationCampaign.update({
        where: { id: campaignId },
        data: {
          status: nextStatus,
          scheduledAt: nextStatus === 'SCHEDULED' ? availableAt : campaign.scheduledAt,
          audienceSnapshot: snapshot as Prisma.InputJsonValue,
          filter: filter as Prisma.InputJsonValue,
        },
      });

      await tx.notificationMessage.createMany({
        data: members.map((member) =>
          this.messageRow(tenantId, campaign, member, churchName, availableAt, capabilities, pushTokens),
        ),
      });

      await this.outbox.enqueue(
        tx,
        campaignEvent(tenantId, eventType, campaignId, {
          channel: campaign.channel,
          recipientCount: members.length,
          scheduledAt: availableAt.toISOString(),
        }),
      );
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: eventType,
          resourceType: 'notification.campaign',
          resourceId: campaignId,
          metadata: { recipientCount: members.length },
        },
        tx,
      );
    });

    return this.get(tenantId, campaignId);
  }

  private messageRow(
    tenantId: string,
    campaign: {
      id: string;
      channel: NotificationChannel;
      subject: string | null;
      body: string;
      html: string | null;
    },
    member: MemberRow,
    churchName: string,
    availableAt: Date,
    capabilities: ReturnType<NotificationCampaignService['channelCapabilities']>,
    pushTokens: Map<string, string>,
  ): Prisma.NotificationMessageCreateManyInput {
    const vars = varsFromMember(member, churchName);
    const token = member.userId ? pushTokens.get(member.userId) ?? null : null;
    const address = addressFor(campaign.channel, member, token);
    const blocked = blockedReasonFor(campaign.channel, address, capabilities);
    const inApp = campaign.channel === 'IN_APP';
    return {
      id: randomUUID(),
      tenantId,
      campaignId: campaign.id,
      memberId: member.id,
      userId: member.userId,
      channel: campaign.channel,
      status: blocked ? 'BLOCKED' : inApp ? 'SENT' : 'PENDING',
      address,
      subject: campaign.subject ? renderTemplate(campaign.subject, vars) : null,
      body: renderTemplate(campaign.body, vars),
      html: campaign.html ? renderTemplate(campaign.html, vars) : null,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      availableAt,
      sentAt: inApp && !blocked ? new Date() : null,
      blockedReason: blocked,
    };
  }

  private async pushTokens(tenantId: string, members: MemberRow[]): Promise<Map<string, string>> {
    const userIds = members.map((member) => member.userId).filter((id): id is string => Boolean(id));
    if (userIds.length === 0) return new Map();
    const devices = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationDevice.findMany({
        where: { tenantId, userId: { in: userIds } },
        orderBy: { lastSeenAt: 'desc' },
        select: { userId: true, token: true },
      }),
    );
    const map = new Map<string, string>();
    for (const device of devices) {
      if (!map.has(device.userId)) map.set(device.userId, device.token);
    }
    return map;
  }

  private channelCapabilities() {
    const n = this.config.notifications;
    return {
      email: n.resendApiKey.length > 0,
      sms: n.twilioAccountSid.length > 0 && n.twilioAuthToken.length > 0 && n.smsFrom.length > 0,
      whatsapp:
        n.twilioAccountSid.length > 0 && n.twilioAuthToken.length > 0 && n.whatsappFrom.length > 0,
      push: n.pushEndpoint.length > 0,
      production: this.config.isProduction,
    };
  }

  private async resolveCopy(
    tenantId: string,
    channel: NotificationChannel,
    input: NotificationCampaignCreateRequest,
  ): Promise<{ subject: string | null; body: string; html: string | null }> {
    if (!input.templateId) {
      return {
        subject: input.subject ?? null,
        body: input.body ?? '',
        html: input.html ?? null,
      };
    }
    const template = await this.templates.getTemplate(tenantId, input.templateId);
    if (template.channel !== channel) {
      throw new DomainError(
        'NOTIFICATION_CAMPAIGN_NOT_SENDABLE',
        'That template is for a different channel',
      );
    }
    if (template.status === 'ARCHIVED') {
      throw new DomainError('NOTIFICATION_CAMPAIGN_NOT_SENDABLE', 'That template has been archived');
    }
    return {
      subject: input.subject ?? template.subject,
      body: input.body ?? template.body,
      html: input.html ?? template.html,
    };
  }

  private async resolveFilter(
    tenantId: string,
    audienceId: string | null,
    stored: unknown,
  ) {
    if (audienceId) {
      const audience = await this.templates.getAudience(tenantId, audienceId);
      return audience.filter;
    }
    return parseAudienceFilter(stored);
  }

  private async findCampaign(tenantId: string, campaignId: string) {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationCampaign.findFirst({ where: { id: campaignId, tenantId } }),
    );
    if (!row) {
      throw new DomainError('NOTIFICATION_CAMPAIGN_NOT_FOUND', 'That campaign could not be found');
    }
    return row;
  }

  private async withCounts(
    tenantId: string,
    row: Prisma.NotificationCampaignGetPayload<object>,
  ): Promise<NotificationCampaign> {
    const grouped = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationMessage.groupBy({
        by: ['status'],
        where: { tenantId, campaignId: row.id },
        _count: { _all: true },
      }),
    );
    let recipientCount = 0;
    let sentCount = 0;
    let failedCount = 0;
    let blockedCount = 0;
    for (const entry of grouped) {
      recipientCount += entry._count._all;
      if (entry.status === 'SENT' || entry.status === 'DELIVERED') sentCount += entry._count._all;
      if (entry.status === 'FAILED') failedCount += entry._count._all;
      if (entry.status === 'BLOCKED') blockedCount += entry._count._all;
    }
    return toCampaign(row, { recipientCount, sentCount, failedCount, blockedCount });
  }
}
