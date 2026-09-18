import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';
import { notificationAudienceFilterSchema } from './audience.schemas';
import {
  notificationCampaignStatusSchema,
  notificationChannelSchema,
  notificationMessageStatusSchema,
} from './enums';

const campaignBodySchema = z.string().trim().min(1).max(20000);
const campaignHtmlSchema = z.string().trim().min(1).max(50000);

export const notificationCampaignCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    channel: notificationChannelSchema,
    templateId: uuidSchema.optional(),
    subject: z.string().trim().min(1).max(200).optional(),
    body: campaignBodySchema.optional(),
    html: campaignHtmlSchema.optional(),
    audienceId: uuidSchema.optional(),
    filter: notificationAudienceFilterSchema.optional(),
    scheduledAt: z.string().datetime().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.templateId && !value.body) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body'],
        message: 'Provide a template or an inline body',
      });
    }
    if (value.channel === 'EMAIL' && !value.templateId && !value.subject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subject'],
        message: 'Email campaigns require a subject when no template is used',
      });
    }
    if (value.channel !== 'EMAIL' && value.html) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['html'],
        message: 'HTML is only valid on email campaigns',
      });
    }
  });

export type NotificationCampaignCreateRequest = z.infer<typeof notificationCampaignCreateSchema>;

export const notificationCampaignUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  subject: z.string().trim().min(1).max(200).nullable().optional(),
  body: campaignBodySchema.optional(),
  html: campaignHtmlSchema.nullable().optional(),
  audienceId: uuidSchema.nullable().optional(),
  filter: notificationAudienceFilterSchema.nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export type NotificationCampaignUpdateRequest = z.infer<typeof notificationCampaignUpdateSchema>;

export const notificationCampaignListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: notificationCampaignStatusSchema.optional(),
  channel: notificationChannelSchema.optional(),
});

export type NotificationCampaignListQuery = z.infer<typeof notificationCampaignListQuerySchema>;

export const notificationCampaignScheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
});

export type NotificationCampaignScheduleRequest = z.infer<
  typeof notificationCampaignScheduleSchema
>;

export const notificationCampaignSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  name: z.string(),
  channel: notificationChannelSchema,
  status: notificationCampaignStatusSchema,
  templateId: uuidSchema.nullable(),
  subject: z.string().nullable(),
  body: z.string(),
  html: z.string().nullable(),
  audienceId: uuidSchema.nullable(),
  filter: notificationAudienceFilterSchema,
  scheduledAt: z.string().datetime().nullable(),
  sentAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  createdByUserId: uuidSchema.nullable(),
  recipientCount: z.number().int().min(0),
  sentCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  blockedCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type NotificationCampaign = z.infer<typeof notificationCampaignSchema>;

export const notificationCampaignPageSchema = paginatedSchema(notificationCampaignSchema);

export type NotificationCampaignPage = z.infer<typeof notificationCampaignPageSchema>;

export const notificationMessageListQuerySchema = paginationQuerySchema.extend({
  status: notificationMessageStatusSchema.optional(),
});

export type NotificationMessageListQuery = z.infer<typeof notificationMessageListQuerySchema>;

export const notificationMessageSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  campaignId: uuidSchema,
  memberId: uuidSchema.nullable(),
  userId: uuidSchema.nullable(),
  channel: notificationChannelSchema,
  status: notificationMessageStatusSchema,
  address: z.string().nullable(),
  subject: z.string().nullable(),
  body: z.string(),
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  availableAt: z.string().datetime(),
  sentAt: z.string().datetime().nullable(),
  readAt: z.string().datetime().nullable(),
  blockedReason: z.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type NotificationMessage = z.infer<typeof notificationMessageSchema>;

export const notificationMessagePageSchema = paginatedSchema(notificationMessageSchema);

export type NotificationMessagePage = z.infer<typeof notificationMessagePageSchema>;

export const notificationInboxListQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
});

export type NotificationInboxListQuery = z.infer<typeof notificationInboxListQuerySchema>;

export const notificationDeviceRegisterSchema = z.object({
  platform: z.enum(['WEB', 'IOS', 'ANDROID']),
  token: z.string().trim().min(8).max(512),
});

export type NotificationDeviceRegisterRequest = z.infer<typeof notificationDeviceRegisterSchema>;

export const notificationDeviceSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  userId: uuidSchema,
  platform: z.enum(['WEB', 'IOS', 'ANDROID']),
  token: z.string(),
  lastSeenAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export type NotificationDevice = z.infer<typeof notificationDeviceSchema>;

export const notificationAnalyticsSchema = z.object({
  campaignId: uuidSchema.nullable(),
  from: z.string().datetime().nullable(),
  to: z.string().datetime().nullable(),
  campaigns: z.number().int().min(0),
  recipients: z.number().int().min(0),
  sent: z.number().int().min(0),
  delivered: z.number().int().min(0),
  failed: z.number().int().min(0),
  blocked: z.number().int().min(0),
  cancelled: z.number().int().min(0),
  pending: z.number().int().min(0),
  read: z.number().int().min(0),
  byChannel: z.array(
    z.object({
      channel: notificationChannelSchema,
      recipients: z.number().int().min(0),
      sent: z.number().int().min(0),
      failed: z.number().int().min(0),
      blocked: z.number().int().min(0),
    }),
  ),
});

export type NotificationAnalytics = z.infer<typeof notificationAnalyticsSchema>;

export const notificationAnalyticsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type NotificationAnalyticsQuery = z.infer<typeof notificationAnalyticsQuerySchema>;
