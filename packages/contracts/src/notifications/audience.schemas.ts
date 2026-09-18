import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';
import {
  memberGenderSchema,
  memberStatusSchema,
  maritalStatusSchema,
} from '../membership/member.schemas';

const tagSchema = z.string().trim().min(1).max(40);

/**
 * A saved or inline membership filter. The same fields the directory list
 * already understands, plus an optional explicit id list.
 */
export const notificationAudienceFilterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: memberStatusSchema.optional(),
  gender: memberGenderSchema.optional(),
  maritalStatus: maritalStatusSchema.optional(),
  departmentId: uuidSchema.optional(),
  familyId: uuidSchema.optional(),
  volunteerRoleId: uuidSchema.optional(),
  tag: tagSchema.optional(),
  memberIds: z.array(uuidSchema).max(5000).optional(),
});

export type NotificationAudienceFilter = z.infer<typeof notificationAudienceFilterSchema>;

export const notificationAudienceCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  filter: notificationAudienceFilterSchema.default({}),
});

export type NotificationAudienceCreateRequest = z.infer<typeof notificationAudienceCreateSchema>;

export const notificationAudienceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  filter: notificationAudienceFilterSchema.optional(),
});

export type NotificationAudienceUpdateRequest = z.infer<typeof notificationAudienceUpdateSchema>;

export const notificationAudienceListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
});

export type NotificationAudienceListQuery = z.infer<typeof notificationAudienceListQuerySchema>;

export const notificationAudienceSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  filter: notificationAudienceFilterSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type NotificationAudience = z.infer<typeof notificationAudienceSchema>;

export const notificationAudiencePageSchema = paginatedSchema(notificationAudienceSchema);

export type NotificationAudiencePage = z.infer<typeof notificationAudiencePageSchema>;

export const notificationAudiencePreviewSchema = z.object({
  audienceId: uuidSchema.nullable(),
  total: z.number().int().min(0),
  sample: z.array(
    z.object({
      id: uuidSchema,
      fullName: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
    }),
  ),
});

export type NotificationAudiencePreview = z.infer<typeof notificationAudiencePreviewSchema>;
