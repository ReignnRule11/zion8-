import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  TERMINAL_MESSAGE_STATUSES,
  notificationAudienceFilterSchema,
  type NotificationAnalytics,
  type NotificationAudience,
  type NotificationAudienceFilter,
  type NotificationCampaign,
  type NotificationCampaignStatus,
  type NotificationChannel,
  type NotificationDevice,
  type NotificationMessage,
  type NotificationMessageStatus,
  type NotificationTemplate,
} from '@zion8/contracts';
import type { IntegrationEvent } from '../../infrastructure/events/event-publisher.port';

export const BASE_BACKOFF_MS = 5_000;
export const MAX_BACKOFF_MS = 300_000;
export const DEFAULT_MAX_ATTEMPTS = 5;

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export interface TemplateVars {
  firstName: string;
  lastName: string;
  fullName: string;
  preferredName: string;
  email: string;
  phone: string;
  churchName: string;
}

export function pageArgs(query: { offset: number; limit: number }): { skip: number; take: number } {
  return { skip: query.offset, take: query.limit };
}

export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function fullName(parts: {
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
}): string {
  const first = parts.preferredName?.trim() || parts.firstName;
  return [first, parts.middleName, parts.lastName]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join(' ');
}

export function renderTemplate(source: string, vars: TemplateVars): string {
  return source.replace(PLACEHOLDER, (_match, key: string) => {
    const value = vars[key as keyof TemplateVars];
    return value ?? '';
  });
}

export function varsFromMember(
  member: {
    firstName: string;
    middleName?: string | null;
    lastName: string;
    preferredName?: string | null;
    email?: string | null;
    phone?: string | null;
  },
  churchName: string,
): TemplateVars {
  return {
    firstName: member.firstName,
    lastName: member.lastName,
    fullName: fullName(member),
    preferredName: member.preferredName?.trim() || member.firstName,
    email: member.email ?? '',
    phone: member.phone ?? '',
    churchName,
  };
}

export function parseAudienceFilter(value: unknown): NotificationAudienceFilter {
  const parsed = notificationAudienceFilterSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function memberWhere(
  tenantId: string,
  filter: NotificationAudienceFilter,
): Prisma.MemberWhereInput {
  return {
    tenantId,
    archivedAt: null,
    ...(filter.status ? { status: filter.status } : { status: 'ACTIVE' }),
    ...(filter.gender ? { gender: filter.gender } : {}),
    ...(filter.maritalStatus ? { maritalStatus: filter.maritalStatus } : {}),
    ...(filter.tag ? { tags: { has: filter.tag } } : {}),
    ...(filter.departmentId
      ? { departmentMembers: { some: { departmentId: filter.departmentId } } }
      : {}),
    ...(filter.familyId ? { families: { some: { familyId: filter.familyId } } } : {}),
    ...(filter.volunteerRoleId
      ? { volunteerAssignments: { some: { roleId: filter.volunteerRoleId } } }
      : {}),
    ...(filter.memberIds && filter.memberIds.length > 0 ? { id: { in: filter.memberIds } } : {}),
    ...(filter.search ? searchFilter(filter.search) : {}),
  };
}

function searchFilter(search: string): Prisma.MemberWhereInput {
  return {
    OR: [
      { firstName: { contains: search, mode: 'insensitive' } },
      { middleName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { preferredName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ],
  };
}

export function addressFor(
  channel: NotificationChannel,
  member: { email?: string | null; phone?: string | null },
  deviceToken?: string | null,
): string | null {
  switch (channel) {
    case 'EMAIL':
      return member.email ?? null;
    case 'SMS':
    case 'WHATSAPP':
      return member.phone ?? null;
    case 'PUSH':
      return deviceToken ?? null;
    case 'IN_APP':
      return member.email ?? member.phone ?? 'in-app';
    default:
      return null;
  }
}

export function blockedReasonFor(
  channel: NotificationChannel,
  address: string | null,
  capabilities: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    push: boolean;
    production: boolean;
  },
): string | null {
  if (channel === 'IN_APP') return null;
  if (!address) {
    return channel === 'PUSH' ? 'NO_DEVICE_TOKEN' : 'MISSING_CONTACT';
  }
  if (!capabilities.production) return null;
  if (channel === 'EMAIL' && !capabilities.email) return 'EMAIL_NOT_CONFIGURED';
  if (channel === 'SMS' && !capabilities.sms) return 'SMS_NOT_CONFIGURED';
  if (channel === 'WHATSAPP' && !capabilities.whatsapp) return 'WHATSAPP_NOT_CONFIGURED';
  if (channel === 'PUSH' && !capabilities.push) return 'PUSH_NOT_CONFIGURED';
  return null;
}

export function backoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(attempts - 1, 0), MAX_BACKOFF_MS);
}

export function campaignStatusFromCounts(counts: {
  total: number;
  pending: number;
  failed: number;
  blocked: number;
  cancelled: number;
}): NotificationCampaignStatus {
  if (counts.total === 0) return 'FAILED';
  if (counts.pending > 0) return 'SENDING';
  if (counts.cancelled === counts.total) return 'CANCELLED';
  if (counts.failed + counts.blocked === counts.total) return 'FAILED';
  return 'SENT';
}

export function isTerminalMessage(status: NotificationMessageStatus): boolean {
  return (TERMINAL_MESSAGE_STATUSES as readonly string[]).includes(status);
}

export function toTemplate(row: {
  id: string;
  tenantId: string;
  name: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  html: string | null;
  status: NotificationTemplate['status'];
  createdAt: Date;
  updatedAt: Date;
}): NotificationTemplate {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    html: row.html,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAudience(row: {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  filter: unknown;
  createdAt: Date;
  updatedAt: Date;
}): NotificationAudience {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    filter: parseAudienceFilter(row.filter),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCampaign(
  row: {
    id: string;
    tenantId: string;
    name: string;
    channel: NotificationChannel;
    status: NotificationCampaignStatus;
    templateId: string | null;
    subject: string | null;
    body: string;
    html: string | null;
    audienceId: string | null;
    filter: unknown;
    scheduledAt: Date | null;
    sentAt: Date | null;
    cancelledAt: Date | null;
    createdByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  counts: { recipientCount: number; sentCount: number; failedCount: number; blockedCount: number },
): NotificationCampaign {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    channel: row.channel,
    status: row.status,
    templateId: row.templateId,
    subject: row.subject,
    body: row.body,
    html: row.html,
    audienceId: row.audienceId,
    filter: parseAudienceFilter(row.filter),
    scheduledAt: toIso(row.scheduledAt),
    sentAt: toIso(row.sentAt),
    cancelledAt: toIso(row.cancelledAt),
    createdByUserId: row.createdByUserId,
    recipientCount: counts.recipientCount,
    sentCount: counts.sentCount,
    failedCount: counts.failedCount,
    blockedCount: counts.blockedCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMessage(row: {
  id: string;
  tenantId: string;
  campaignId: string;
  memberId: string | null;
  userId: string | null;
  channel: NotificationChannel;
  status: NotificationMessageStatus;
  address: string | null;
  subject: string | null;
  body: string;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  sentAt: Date | null;
  readAt: Date | null;
  blockedReason: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}): NotificationMessage {
  return {
    id: row.id,
    tenantId: row.tenantId,
    campaignId: row.campaignId,
    memberId: row.memberId,
    userId: row.userId,
    channel: row.channel,
    status: row.status,
    address: row.address,
    subject: row.subject,
    body: row.body,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    availableAt: row.availableAt.toISOString(),
    sentAt: toIso(row.sentAt),
    readAt: toIso(row.readAt),
    blockedReason: row.blockedReason,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDevice(row: {
  id: string;
  tenantId: string;
  userId: string;
  platform: NotificationDevice['platform'];
  token: string;
  lastSeenAt: Date;
  createdAt: Date;
}): NotificationDevice {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    platform: row.platform,
    token: row.token,
    lastSeenAt: row.lastSeenAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function emptyAnalytics(
  campaignId: string | null,
  from: string | null,
  to: string | null,
): NotificationAnalytics {
  return {
    campaignId,
    from,
    to,
    campaigns: 0,
    recipients: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    blocked: 0,
    cancelled: 0,
    pending: 0,
    read: 0,
    byChannel: [],
  };
}

export function campaignEvent(
  tenantId: string,
  type: string,
  campaignId: string,
  payload: Record<string, unknown>,
): IntegrationEvent {
  return {
    id: randomUUID(),
    tenantId,
    type,
    aggregateType: 'notification.campaign',
    aggregateId: campaignId,
    payload,
    headers: {},
    occurredAt: new Date().toISOString(),
  };
}
