import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { emailSchema, personNameSchema, phoneSchema, uuidSchema } from '../common/primitives';

/**
 * Visitors are the pre-membership pipeline: someone who came, whether they came
 * back, who is following them up, and whether they eventually became a member.
 * A visitor is kept as its own record rather than an "inactive member" so the
 * follow-up workflow and conversion history survive intact.
 */

export const VisitorStatus = {
  NEW: 'NEW',
  FOLLOW_UP: 'FOLLOW_UP',
  RETURNING: 'RETURNING',
  CONNECTED: 'CONNECTED',
  CONVERTED: 'CONVERTED',
  DORMANT: 'DORMANT',
  ARCHIVED: 'ARCHIVED',
} as const;

export type VisitorStatus = (typeof VisitorStatus)[keyof typeof VisitorStatus];

export const visitorStatusSchema = z.enum(
  Object.values(VisitorStatus) as [VisitorStatus, ...VisitorStatus[]],
);

export const VisitorSource = {
  INVITED_BY_MEMBER: 'INVITED_BY_MEMBER',
  WALK_IN: 'WALK_IN',
  EVENT: 'EVENT',
  WEBSITE: 'WEBSITE',
  OUTREACH: 'OUTREACH',
  SOCIAL_MEDIA: 'SOCIAL_MEDIA',
  REFERRAL: 'REFERRAL',
  OTHER: 'OTHER',
} as const;

export type VisitorSource = (typeof VisitorSource)[keyof typeof VisitorSource];

export const visitorSourceSchema = z.enum(
  Object.values(VisitorSource) as [VisitorSource, ...VisitorSource[]],
);

export const visitorSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  status: visitorStatusSchema.default('NEW'),
  source: visitorSourceSchema.default('OTHER'),
  firstVisitAt: z.string().datetime().optional(),
  invitedByMemberId: uuidSchema.optional(),
  assignedToUserId: uuidSchema.optional(),
  addressLine1: z.string().trim().max(180).optional(),
  city: z.string().trim().max(120).optional(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase())
    .optional(),
  interests: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  notes: z.string().trim().max(4000).optional(),
  followUpAt: z.string().datetime().optional(),
});

export type VisitorInput = z.input<typeof visitorSchema>;
export type VisitorRequest = z.output<typeof visitorSchema>;

export const visitorUpdateSchema = visitorSchema.partial().extend({
  email: emailSchema.nullable().optional(),
  phone: phoneSchema.nullable().optional(),
  firstVisitAt: z.string().datetime().nullable().optional(),
  invitedByMemberId: uuidSchema.nullable().optional(),
  assignedToUserId: uuidSchema.nullable().optional(),
  addressLine1: z.string().trim().max(180).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase())
    .nullable()
    .optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
});

export type VisitorUpdateRequest = z.infer<typeof visitorUpdateSchema>;

export const visitorVisitSchema = z.object({
  occurredAt: z.string().datetime(),
  serviceName: z.string().trim().max(120).optional(),
  attended: z.boolean().default(true),
  notes: z.string().trim().max(1000).optional(),
});

export type VisitorVisitRequest = z.infer<typeof visitorVisitSchema>;

export const visitorVisitResponseSchema = visitorVisitSchema.extend({
  id: uuidSchema,
  visitorId: uuidSchema,
  recordedByUserId: uuidSchema.nullable(),
  createdAt: z.string().datetime(),
});

export type VisitorVisitResponse = z.infer<typeof visitorVisitResponseSchema>;

export const visitorConvertSchema = z.object({
  member: visitorSchema
    .pick({
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      addressLine1: true,
      city: true,
      countryCode: true,
    })
    .partial()
    .optional(),
  joinedAt: z.string().datetime().optional(),
});

export type VisitorConvertRequest = z.infer<typeof visitorConvertSchema>;

export const visitorListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: visitorStatusSchema.optional(),
  source: visitorSourceSchema.optional(),
  assignedToUserId: uuidSchema.optional(),
  followUpBefore: z.string().datetime().optional(),
});

export type VisitorListQuery = z.infer<typeof visitorListQuerySchema>;

export const visitorSummarySchema = z.object({
  id: uuidSchema,
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  status: visitorStatusSchema,
  source: visitorSourceSchema,
  firstVisitAt: z.string().datetime().nullable(),
  lastVisitAt: z.string().datetime().nullable(),
  visitCount: z.number().int().min(0),
  assignedToUserId: uuidSchema.nullable(),
  followUpAt: z.string().datetime().nullable(),
  convertedMemberId: uuidSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type VisitorSummary = z.infer<typeof visitorSummarySchema>;

export const visitorResponseSchema = visitorSchema.extend({
  id: uuidSchema,
  tenantId: uuidSchema,
  convertedMemberId: uuidSchema.nullable(),
  convertedAt: z.string().datetime().nullable(),
  visits: z.array(visitorVisitResponseSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type VisitorResponse = z.infer<typeof visitorResponseSchema>;

export const visitorPageSchema = paginatedSchema(visitorSummarySchema);

export type VisitorPage = z.infer<typeof visitorPageSchema>;
