import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';

/**
 * Volunteer roles describe the jobs a church needs filled — sound desk, welcome
 * team, children's check-in — and assignments record who is currently serving in
 * them. A role can exist unfilled, which is what makes "we need three more ushers
 * on Sunday" a queryable fact rather than a conversation.
 */

export const VolunteerCommitment = {
  ONE_OFF: 'ONE_OFF',
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  MONTHLY: 'MONTHLY',
  SEASONAL: 'SEASONAL',
  ON_CALL: 'ON_CALL',
} as const;

export type VolunteerCommitment = (typeof VolunteerCommitment)[keyof typeof VolunteerCommitment];

export const volunteerCommitmentSchema = z.enum(
  Object.values(VolunteerCommitment) as [VolunteerCommitment, ...VolunteerCommitment[]],
);

export const VolunteerAssignmentStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
} as const;

export type VolunteerAssignmentStatus =
  (typeof VolunteerAssignmentStatus)[keyof typeof VolunteerAssignmentStatus];

export const volunteerAssignmentStatusSchema = z.enum(
  Object.values(VolunteerAssignmentStatus) as [
    VolunteerAssignmentStatus,
    ...VolunteerAssignmentStatus[],
  ],
);

export const volunteerRoleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  departmentId: uuidSchema.optional(),
  commitment: volunteerCommitmentSchema.default('WEEKLY'),
  requiredCount: z.number().int().min(1).max(500).default(1),
  requiresBackgroundCheck: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type VolunteerRoleRequest = z.infer<typeof volunteerRoleSchema>;

export const volunteerRoleUpdateSchema = volunteerRoleSchema.partial().extend({
  description: z.string().trim().max(2000).nullable().optional(),
  departmentId: uuidSchema.nullable().optional(),
});

export type VolunteerRoleUpdateRequest = z.infer<typeof volunteerRoleUpdateSchema>;

export const volunteerAssignmentSchema = z.object({
  memberId: uuidSchema,
  status: volunteerAssignmentStatusSchema.default('ACTIVE'),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  backgroundCheckAt: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type VolunteerAssignmentRequest = z.infer<typeof volunteerAssignmentSchema>;

export const volunteerAssignmentUpdateSchema = volunteerAssignmentSchema.partial().extend({
  endsAt: z.string().datetime().nullable().optional(),
  backgroundCheckAt: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type VolunteerAssignmentUpdateRequest = z.infer<
  typeof volunteerAssignmentUpdateSchema
>;

export const volunteerAssignmentResponseSchema = z.object({
  id: uuidSchema,
  roleId: uuidSchema,
  memberId: uuidSchema,
  memberName: z.string(),
  memberStatus: z.string(),
  status: volunteerAssignmentStatusSchema,
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  backgroundCheckAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type VolunteerAssignmentResponse = z.infer<
  typeof volunteerAssignmentResponseSchema
>;

export const volunteerRoleSummarySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  departmentId: uuidSchema.nullable(),
  departmentName: z.string().nullable(),
  commitment: volunteerCommitmentSchema,
  requiredCount: z.number().int().min(1),
  activeCount: z.number().int().min(0),
  openSlots: z.number().int().min(0),
  requiresBackgroundCheck: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type VolunteerRoleSummary = z.infer<typeof volunteerRoleSummarySchema>;

export const volunteerRoleResponseSchema = volunteerRoleSchema.extend({
  id: uuidSchema,
  tenantId: uuidSchema,
  assignments: z.array(volunteerAssignmentResponseSchema),
  activeCount: z.number().int().min(0),
  openSlots: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type VolunteerRoleResponse = z.infer<typeof volunteerRoleResponseSchema>;

export const volunteerRoleListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  departmentId: uuidSchema.optional(),
  commitment: volunteerCommitmentSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  withOpenSlotsOnly: z.coerce.boolean().optional(),
});

export type VolunteerRoleListQuery = z.infer<typeof volunteerRoleListQuerySchema>;

export const volunteerRolePageSchema = paginatedSchema(volunteerRoleSummarySchema);

export type VolunteerRolePage = z.infer<typeof volunteerRolePageSchema>;
