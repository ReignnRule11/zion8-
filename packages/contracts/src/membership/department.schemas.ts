import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';

/**
 * Departments are the operational and ministry teams a church runs: ushering,
 * choir, media, children's church, outreach. They are distinct from the
 * `MINISTRY_*` permission family, which governs the later community/ministry
 * grouping feature.
 */

export const DepartmentKind = {
  MINISTRY: 'MINISTRY',
  CHOIR: 'CHOIR',
  USHERING: 'USHERING',
  MEDIA: 'MEDIA',
  CHILDREN: 'CHILDREN',
  YOUTH: 'YOUTH',
  ADULT: 'ADULT',
  OUTREACH: 'OUTREACH',
  PRAYER: 'PRAYER',
  HOSPITALITY: 'HOSPITALITY',
  ADMINISTRATION: 'ADMINISTRATION',
  OTHER: 'OTHER',
} as const;

export type DepartmentKind = (typeof DepartmentKind)[keyof typeof DepartmentKind];

export const departmentKindSchema = z.enum(
  Object.values(DepartmentKind) as [DepartmentKind, ...DepartmentKind[]],
);

export const DepartmentMemberRole = {
  LEADER: 'LEADER',
  ASSISTANT_LEADER: 'ASSISTANT_LEADER',
  COORDINATOR: 'COORDINATOR',
  MEMBER: 'MEMBER',
} as const;

export type DepartmentMemberRole =
  (typeof DepartmentMemberRole)[keyof typeof DepartmentMemberRole];

export const departmentMemberRoleSchema = z.enum(
  Object.values(DepartmentMemberRole) as [DepartmentMemberRole, ...DepartmentMemberRole[]],
);

export const DepartmentMemberStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type DepartmentMemberStatus =
  (typeof DepartmentMemberStatus)[keyof typeof DepartmentMemberStatus];

export const departmentMemberStatusSchema = z.enum(
  Object.values(DepartmentMemberStatus) as [
    DepartmentMemberStatus,
    ...DepartmentMemberStatus[],
  ],
);

export const departmentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: departmentKindSchema.default('MINISTRY'),
  description: z.string().trim().max(2000).optional(),
  leaderMemberId: uuidSchema.optional(),
  meetingDay: z
    .enum(['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'])
    .optional(),
  meetingTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM format')
    .optional(),
  location: z.string().trim().max(160).optional(),
  isActive: z.boolean().default(true),
});

export type DepartmentRequest = z.infer<typeof departmentSchema>;

export const departmentUpdateSchema = departmentSchema.partial().extend({
  description: z.string().trim().max(2000).nullable().optional(),
  leaderMemberId: uuidSchema.nullable().optional(),
  meetingDay: departmentSchema.shape.meetingDay.nullable().optional(),
  meetingTime: departmentSchema.shape.meetingTime.nullable().optional(),
  location: z.string().trim().max(160).nullable().optional(),
});

export type DepartmentUpdateRequest = z.infer<typeof departmentUpdateSchema>;

export const departmentMemberAddSchema = z.object({
  memberId: uuidSchema,
  role: departmentMemberRoleSchema.default('MEMBER'),
  joinedAt: z.string().datetime().optional(),
});

export type DepartmentMemberAddRequest = z.infer<typeof departmentMemberAddSchema>;

export const departmentMemberUpdateSchema = z.object({
  role: departmentMemberRoleSchema.optional(),
  status: departmentMemberStatusSchema.optional(),
  leftAt: z.string().datetime().nullable().optional(),
});

export type DepartmentMemberUpdateRequest = z.infer<typeof departmentMemberUpdateSchema>;

export const departmentMemberSchema = z.object({
  id: uuidSchema,
  departmentId: uuidSchema,
  memberId: uuidSchema,
  memberName: z.string(),
  memberStatus: z.string(),
  role: departmentMemberRoleSchema,
  status: departmentMemberStatusSchema,
  joinedAt: z.string().datetime(),
  leftAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type DepartmentMember = z.infer<typeof departmentMemberSchema>;

export const departmentSummarySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  kind: departmentKindSchema,
  description: z.string().nullable(),
  isActive: z.boolean(),
  memberCount: z.number().int().min(0),
  leaderMemberId: uuidSchema.nullable(),
  leaderName: z.string().nullable(),
  meetingDay: z.string().nullable(),
  meetingTime: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type DepartmentSummary = z.infer<typeof departmentSummarySchema>;

export const departmentResponseSchema = departmentSchema.extend({
  id: uuidSchema,
  tenantId: uuidSchema,
  members: z.array(departmentMemberSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type DepartmentResponse = z.infer<typeof departmentResponseSchema>;

export const departmentListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  kind: departmentKindSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  memberId: uuidSchema.optional(),
});

export type DepartmentListQuery = z.infer<typeof departmentListQuerySchema>;

export const departmentPageSchema = paginatedSchema(departmentSummarySchema);

export type DepartmentPage = z.infer<typeof departmentPageSchema>;
