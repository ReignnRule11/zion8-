import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';
import { notificationChannelSchema, notificationTemplateStatusSchema } from './enums';

const templateBodySchema = z.string().trim().min(1).max(20000);
const templateHtmlSchema = z.string().trim().min(1).max(50000);

export const notificationTemplateCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    channel: notificationChannelSchema,
    subject: z.string().trim().min(1).max(200).optional(),
    body: templateBodySchema,
    html: templateHtmlSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.channel === 'EMAIL' && !value.subject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subject'],
        message: 'Email templates require a subject',
      });
    }
    if (value.channel !== 'EMAIL' && value.html) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['html'],
        message: 'HTML is only valid on email templates',
      });
    }
  });

export type NotificationTemplateCreateRequest = z.infer<typeof notificationTemplateCreateSchema>;

export const notificationTemplateUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  subject: z.string().trim().min(1).max(200).nullable().optional(),
  body: templateBodySchema.optional(),
  html: templateHtmlSchema.nullable().optional(),
  status: notificationTemplateStatusSchema.optional(),
});

export type NotificationTemplateUpdateRequest = z.infer<typeof notificationTemplateUpdateSchema>;

export const notificationTemplateListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  channel: notificationChannelSchema.optional(),
  includeArchived: z.coerce.boolean().optional(),
});

export type NotificationTemplateListQuery = z.infer<typeof notificationTemplateListQuerySchema>;

export const notificationTemplateSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  name: z.string(),
  channel: notificationChannelSchema,
  subject: z.string().nullable(),
  body: z.string(),
  html: z.string().nullable(),
  status: notificationTemplateStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type NotificationTemplate = z.infer<typeof notificationTemplateSchema>;

export const notificationTemplatePageSchema = paginatedSchema(notificationTemplateSchema);

export type NotificationTemplatePage = z.infer<typeof notificationTemplatePageSchema>;
